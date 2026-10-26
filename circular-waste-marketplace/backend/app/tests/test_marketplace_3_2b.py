"""
Segment 3.2b — Seller-side marketplace flows
============================================
Covers the service layer behind:
  GET    /api/v1/marketplace/listings/{id}/bids          (owner-only, 404 otherwise)
  POST   /api/v1/marketplace/listings/{id}/bids/{bid}/accept
  POST   /api/v1/marketplace/listings/{id}/bids/{bid}/reject
  PATCH  /api/v1/marketplace/orders/{id}/ship
  PATCH  /api/v1/marketplace/orders/{id}/deliver
  PATCH  /api/v1/marketplace/listings/{id}            (cancel)
  GET    /api/v1/inventory/lots                       (auth gate)

Repositories and the traceability emitter are replaced with an in-memory store
so state transitions can be asserted without a live Postgres (same constraint as
the rest of the suite, which runs on the mock session from conftest.py).
"""
from __future__ import annotations

import uuid
from decimal import Decimal
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from starlette.testclient import TestClient

from app.services import marketplace_service as ms
from app.services.marketplace_service import MarketplaceService
from app.schemas.marketplace_schemas import (
    BidRejectRequest,
    ListingUpdateRequest,
    OrderDeliverRequest,
    OrderShipRequest,
)


# ---------------------------------------------------------------------------
# In-memory fakes
# ---------------------------------------------------------------------------


class _FakeResult:
    def scalar_one(self) -> int:
        return 0


class FakeSession:
    def __init__(self) -> None:
        self.commits = 0

    async def execute(self, stmt):  # only used for order_code sequence count
        return _FakeResult()

    async def commit(self) -> None:
        self.commits += 1

    async def refresh(self, obj) -> None:
        return None

    async def flush(self) -> None:
        return None


class Store:
    def __init__(self) -> None:
        self.listings: dict[uuid.UUID, SimpleNamespace] = {}
        self.bids: dict[uuid.UUID, SimpleNamespace] = {}
        self.orders: dict[uuid.UUID, SimpleNamespace] = {}
        self.lots: dict[uuid.UUID, SimpleNamespace] = {}
        self.events: list[dict] = []


def _user(role: str = "RECYCLER") -> SimpleNamespace:
    return SimpleNamespace(id=uuid.uuid4(), role=role)


@pytest.fixture
def store(monkeypatch) -> Store:
    s = Store()
    MR = ms.MarketplaceRepository
    IR = ms.InventoryRepository

    async def get_listing_by_id(session, listing_id):
        return s.listings.get(listing_id)

    async def get_bid_by_id(session, bid_id):
        return s.bids.get(bid_id)

    async def list_bids_for_listing(session, listing_id):
        return [b for b in s.bids.values() if b.listing_id == listing_id]

    async def update_bid_status(session, bid_id, new_status):
        s.bids[bid_id].status = new_status
        return s.bids[bid_id]

    async def create_order(session, **fields):
        order = SimpleNamespace(id=uuid.uuid4(), **fields)
        s.orders[order.id] = order
        return order

    async def get_order_by_id(session, order_id):
        return s.orders.get(order_id)

    async def lot_get_by_id(session, lot_id):
        return s.lots.get(lot_id)

    async def lot_update_status(session, lot_id, new_status):
        s.lots[lot_id].status = new_status
        return s.lots[lot_id]

    async def fake_emit(session, *, batch_id, event_type, **kw):
        s.events.append({"batch_id": batch_id, "event_type": event_type, **kw})

    monkeypatch.setattr(MR, "get_listing_by_id", staticmethod(get_listing_by_id))
    monkeypatch.setattr(MR, "get_bid_by_id", staticmethod(get_bid_by_id))
    monkeypatch.setattr(MR, "list_bids_for_listing", staticmethod(list_bids_for_listing))
    monkeypatch.setattr(MR, "update_bid_status", staticmethod(update_bid_status))
    monkeypatch.setattr(MR, "create_order", staticmethod(create_order))
    monkeypatch.setattr(MR, "get_order_by_id", staticmethod(get_order_by_id))
    monkeypatch.setattr(IR, "get_by_id", staticmethod(lot_get_by_id))
    monkeypatch.setattr(IR, "update_status", staticmethod(lot_update_status))
    monkeypatch.setattr(ms, "emit", fake_emit)
    return s


def _seed_listing(s: Store, seller, *, available: float = 100.0, lot_status: str = "reserved"):
    lot = SimpleNamespace(
        id=uuid.uuid4(),
        intake_id=uuid.uuid4(),
        status=lot_status,
        available_kg=Decimal(str(available)),
    )
    s.lots[lot.id] = lot
    listing = SimpleNamespace(
        id=uuid.uuid4(),
        seller_id=seller.id,
        inventory_lot_id=lot.id,
        available_quantity_kg=available,
        unit_price_per_kg=10.0,
        status="active",
    )
    s.listings[listing.id] = listing
    return listing, lot


def _seed_bid(s: Store, listing, buyer, *, qty: str = "40", price: str = "9.50", status: str = "pending"):
    q, p = Decimal(qty), Decimal(price)
    bid = SimpleNamespace(
        id=uuid.uuid4(),
        listing_id=listing.id,
        buyer_user_id=buyer.id,
        bid_price_per_kg=p,
        quantity_kg=q,
        total_amount=p * q,
        message=None,
        status=status,
    )
    s.bids[bid.id] = bid
    return bid


def _seed_order(s: Store, listing, buyer, *, status: str):
    order = SimpleNamespace(
        id=uuid.uuid4(),
        order_code=f"PO-TEST-{uuid.uuid4().hex[:6]}",
        listing_id=listing.id,
        buyer_user_id=buyer.id,
        seller_user_id=listing.seller_id,
        quantity_kg=Decimal("10"),
        status=status,
    )
    s.orders[order.id] = order
    return order


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_seller_lists_bids_on_own_listing(store: Store) -> None:
    seller, buyer, stranger = _user(), _user(), _user()
    listing, _ = _seed_listing(store, seller)
    _seed_bid(store, listing, buyer)
    _seed_bid(store, listing, buyer, qty="5")

    bids = await MarketplaceService.list_bids_for_listing(seller, listing.id, FakeSession())
    assert len(bids) == 2

    admin_bids = await MarketplaceService.list_bids_for_listing(_user("ADMIN"), listing.id, FakeSession())
    assert len(admin_bids) == 2

    with pytest.raises(HTTPException) as exc:
        await MarketplaceService.list_bids_for_listing(stranger, listing.id, FakeSession())
    assert exc.value.status_code == 404  # no existence leak


@pytest.mark.asyncio
async def test_seller_accepts_bid_creates_order(store: Store) -> None:
    seller, buyer = _user(), _user()
    listing, _ = _seed_listing(store, seller, available=100.0)
    bid = _seed_bid(store, listing, buyer, qty="40")

    order = await MarketplaceService.accept_bid(seller, listing.id, bid.id, FakeSession())

    assert order.status == "pending_payment"
    assert order.order_code.startswith("PO-")
    assert order.buyer_user_id == buyer.id
    assert store.bids[bid.id].status == "accepted"
    assert listing.available_quantity_kg == pytest.approx(60.0)
    assert listing.status == "active"


@pytest.mark.asyncio
async def test_seller_accepts_insufficient_stock_bid(store: Store) -> None:
    seller, buyer = _user(), _user()
    listing, _ = _seed_listing(store, seller, available=100.0)
    bid = _seed_bid(store, listing, buyer, qty="150")

    with pytest.raises(HTTPException) as exc:
        await MarketplaceService.accept_bid(seller, listing.id, bid.id, FakeSession())
    assert exc.value.status_code == 422
    assert store.bids[bid.id].status == "pending"
    assert not store.orders


@pytest.mark.asyncio
async def test_seller_rejects_bid(store: Store) -> None:
    seller, buyer = _user(), _user()
    listing, _ = _seed_listing(store, seller)
    bid = _seed_bid(store, listing, buyer)

    result = await MarketplaceService.reject_bid(
        seller, listing.id, bid.id, BidRejectRequest(note="Price too low"), FakeSession()
    )
    assert result.status == "rejected"

    with pytest.raises(HTTPException) as exc:
        await MarketplaceService.reject_bid(seller, listing.id, bid.id, None, FakeSession())
    assert exc.value.status_code == 422  # already rejected

    with pytest.raises(HTTPException) as exc:
        await MarketplaceService.reject_bid(_user(), listing.id, bid.id, None, FakeSession())
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_seller_ships_order(store: Store) -> None:
    seller, buyer = _user(), _user()
    listing, _ = _seed_listing(store, seller)
    order = _seed_order(store, listing, buyer, status="escrow_held")

    shipped = await MarketplaceService.ship_order(
        seller, order.id, OrderShipRequest(tracking_number="TRK-1"), FakeSession()
    )
    assert shipped.status == "shipped"

    unpaid = _seed_order(store, listing, buyer, status="pending_payment")
    with pytest.raises(HTTPException) as exc:
        await MarketplaceService.ship_order(seller, unpaid.id, None, FakeSession())
    assert exc.value.status_code == 422

    paid = _seed_order(store, listing, buyer, status="escrow_held")
    with pytest.raises(HTTPException) as exc:
        await MarketplaceService.ship_order(buyer, paid.id, None, FakeSession())
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_buyer_marks_delivered(store: Store) -> None:
    seller, buyer = _user(), _user()
    listing, _ = _seed_listing(store, seller)
    order = _seed_order(store, listing, buyer, status="shipped")

    with pytest.raises(HTTPException) as exc:
        await MarketplaceService.deliver_order(seller, order.id, None, FakeSession())
    assert exc.value.status_code == 403

    delivered = await MarketplaceService.deliver_order(
        buyer, order.id, OrderDeliverRequest(note="Received"), FakeSession()
    )
    assert delivered.status == "delivered"

    with pytest.raises(HTTPException) as exc:
        await MarketplaceService.deliver_order(buyer, order.id, None, FakeSession())
    assert exc.value.status_code == 422


@pytest.mark.asyncio
async def test_seller_cancels_listing(store: Store) -> None:
    seller, buyer = _user(), _user()
    listing, lot = _seed_listing(store, seller, lot_status="reserved")
    pending = _seed_bid(store, listing, buyer)

    result = await MarketplaceService.cancel_listing(
        seller, listing.id, ListingUpdateRequest(status="cancelled", reason="Stock damaged"), FakeSession()
    )
    assert result.status == "cancelled"
    assert lot.status == "available"
    assert store.bids[pending.id].status == "rejected"

    with pytest.raises(HTTPException) as exc:
        await MarketplaceService.cancel_listing(
            seller, listing.id, ListingUpdateRequest(status="cancelled"), FakeSession()
        )
    assert exc.value.status_code == 422  # no longer active


@pytest.mark.asyncio
async def test_traceability_events_emitted(store: Store) -> None:
    seller, buyer = _user(), _user()
    listing, lot = _seed_listing(store, seller, available=100.0)
    bid = _seed_bid(store, listing, buyer, qty="10")

    order = await MarketplaceService.accept_bid(seller, listing.id, bid.id, FakeSession())
    order.status = "escrow_held"  # simulate buyer payment
    await MarketplaceService.ship_order(seller, order.id, OrderShipRequest(), FakeSession())
    await MarketplaceService.deliver_order(buyer, order.id, OrderDeliverRequest(), FakeSession())

    other_listing, other_lot = _seed_listing(store, seller)
    await MarketplaceService.cancel_listing(
        seller, other_listing.id, ListingUpdateRequest(status="cancelled"), FakeSession()
    )

    types = [e["event_type"] for e in store.events]
    assert types == [
        "order.created_from_bid",
        "order.shipped",
        "order.delivered",
        "listing.cancelled",
    ]
    assert all(e["batch_id"] == lot.intake_id for e in store.events[:3])
    assert store.events[3]["batch_id"] == other_lot.intake_id


# ---------------------------------------------------------------------------
# HTTP auth gates for the new routes
# ---------------------------------------------------------------------------


def test_new_seller_routes_require_auth(client: TestClient) -> None:
    lid, bid, oid = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    calls = [
        ("get", f"/api/v1/inventory/lots"),
        ("get", f"/api/v1/inventory/lots/{lid}"),
        ("post", f"/api/v1/marketplace/listings/{lid}/bids/{bid}/reject"),
        ("patch", f"/api/v1/marketplace/orders/{oid}/ship"),
        ("patch", f"/api/v1/marketplace/orders/{oid}/deliver"),
        ("patch", f"/api/v1/marketplace/listings/{lid}"),
    ]
    for method, url in calls:
        resp = getattr(client, method)(url, json={}) if method != "get" else client.get(url)
        assert resp.status_code == 401, f"{method.upper()} {url} -> {resp.status_code}"


def test_inventory_lots_forbidden_for_generator(client: TestClient, real_user_headers) -> None:
    headers = real_user_headers("GENERATOR")
    resp = client.get("/api/v1/inventory/lots", headers=headers)
    assert resp.status_code == 403
