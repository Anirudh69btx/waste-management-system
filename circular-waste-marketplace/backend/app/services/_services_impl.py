"""
Supplier, Tracking, Sorting, Marketplace, Pricing, Payments, Rewards,
Eco-Store, Analytics, and AI Assessment services.
"""
from __future__ import annotations

import uuid
import asyncio
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.logging import get_logger
from app.core.settings import get_settings
from app.models import (
    EcoOrder, EcoProduct, InventoryLot, InventoryLotStatus, Supplier,
    MarketplaceListing, ListingStatus, Bid, BidStatus,
    PurchaseOrder, PaymentStatus, FulfillmentStatus,
    PricingRule, RewardWallet, RewardTransaction, RewardTransactionType,
    SortingRecord, VehicleTelemetry, WasteAssessment, WasteIntake,
    VerificationStatus,
)
from app.schemas import (
    SupplierProfileRequest, SupplierResponse,
    TrackingPingRequest, TelemetryPingResponse, TransitTrailResponse,
    SortingRecordRequest, SortingRecordResponse, InventoryLotResponse,
    MarketplaceListingRequest, MarketplaceListingResponse,
    BidRequest, BidResponse, CheckoutRequest, PurchaseOrderResponse,
    PricingQuoteResponse, MockWebhookRequest, MockWebhookResponse,
    RewardWalletResponse, RewardTransactionResponse,
    CartValidateRequest, CartValidateResponse, CartItem,
    EcoCheckoutRequest, EcoOrderResponse, EcoProductResponse,
    PublicImpactMetrics, SupplierDashboardResponse,
    RecyclerDashboardResponse, AdminDashboardResponse,
    WasteAssessmentResponse,
)

logger = get_logger(__name__)
settings = get_settings()


# ═══════════════════════════════════════════════════════════════════════════
# SupplierService
# ═══════════════════════════════════════════════════════════════════════════
class SupplierService:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def upsert_profile(self, user_id: str, payload: SupplierProfileRequest) -> SupplierResponse:
        result = await self._db.execute(
            select(Supplier).where(Supplier.user_id == uuid.UUID(user_id))
        )
        supplier = result.scalar_one_or_none()

        if supplier:
            # Update existing
            supplier.business_name = payload.business_name
            supplier.registration_number = payload.registration_number
            supplier.facility_address = payload.facility_address
            supplier.latitude = payload.latitude
            supplier.longitude = payload.longitude
            supplier.contact_phone = payload.contact_phone
        else:
            supplier = Supplier(
                id=uuid.uuid4(),
                user_id=uuid.UUID(user_id),
                business_name=payload.business_name,
                registration_number=payload.registration_number,
                facility_address=payload.facility_address,
                latitude=payload.latitude,
                longitude=payload.longitude,
                contact_phone=payload.contact_phone,
                verification_status=VerificationStatus.PENDING,
            )
            self._db.add(supplier)

        await self._db.flush()
        await self._db.commit()
        return SupplierResponse.model_validate(supplier)

    async def get_by_user_id(self, user_id: str) -> SupplierResponse:
        result = await self._db.execute(
            select(Supplier).where(Supplier.user_id == uuid.UUID(user_id))
        )
        supplier = result.scalar_one_or_none()
        if not supplier:
            raise HTTPException(status_code=404, detail="Supplier profile not found.")
        return SupplierResponse.model_validate(supplier)


# ═══════════════════════════════════════════════════════════════════════════
# TrackingService
# ═══════════════════════════════════════════════════════════════════════════
class TrackingService:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def record_ping(self, payload: TrackingPingRequest) -> TelemetryPingResponse:
        from app.models import WasteTransit
        # Validate transit exists
        result = await self._db.execute(
            select(WasteTransit).where(WasteTransit.id == payload.transit_id)
        )
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Transit not found.")

        ping = VehicleTelemetry(
            transit_id=payload.transit_id,
            latitude=payload.latitude,
            longitude=payload.longitude,
            altitude_meters=payload.altitude_meters,
            speed_kmh=payload.speed_kmh,
            heading_degrees=payload.heading_degrees,
            battery_level=payload.battery_level,
            recorded_at=datetime.now(tz=timezone.utc),
        )
        self._db.add(ping)
        await self._db.flush()
        return TelemetryPingResponse.model_validate(ping)

    async def get_trail(self, transit_id: uuid.UUID) -> TransitTrailResponse:
        from app.models import WasteTransit
        result = await self._db.execute(
            select(WasteTransit)
            .where(WasteTransit.id == transit_id)
            .options(selectinload(WasteTransit.telemetry_pings))
        )
        transit = result.scalar_one_or_none()
        if not transit:
            raise HTTPException(status_code=404, detail="Transit not found.")

        pings = sorted(transit.telemetry_pings, key=lambda p: p.recorded_at)
        return TransitTrailResponse(
            transit_id=transit.id,
            status=transit.status.value,
            pings=[TelemetryPingResponse.model_validate(p) for p in pings],
        )


# ═══════════════════════════════════════════════════════════════════════════
# SortingService
# ═══════════════════════════════════════════════════════════════════════════
class SortingService:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def record_sorting(
        self, payload: SortingRecordRequest, operator_id: str
    ) -> SortingRecordResponse:
        efficiency = (payload.sorted_yield_kg / payload.input_weight_kg) * 100.0

        record = SortingRecord(
            id=uuid.uuid4(),
            intake_id=payload.intake_id,
            facility_location=payload.facility_location,
            input_weight_kg=payload.input_weight_kg,
            sorted_yield_kg=payload.sorted_yield_kg,
            contamination_removed_kg=payload.contamination_removed_kg,
            sorting_efficiency_percent=round(efficiency, 2),
            sorter_operator_id=uuid.UUID(operator_id),
            started_at=payload.started_at,
            completed_at=payload.completed_at,
            created_at=datetime.now(tz=timezone.utc),
        )
        self._db.add(record)
        return SortingRecordResponse.model_validate(record)

    async def list_lots(
        self,
        category_id: Optional[int] = None,
        status_filter: Optional[str] = None,
    ) -> list[InventoryLotResponse]:
        q = select(InventoryLot).options(selectinload(InventoryLot.category))
        if category_id:
            q = q.where(InventoryLot.category_id == category_id)
        if status_filter:
            q = q.where(InventoryLot.status == status_filter)
        result = await self._db.execute(q.order_by(InventoryLot.created_at.desc()).limit(100))
        lots = result.scalars().all()
        return [InventoryLotResponse.model_validate(lot) for lot in lots]


# ═══════════════════════════════════════════════════════════════════════════
# MarketplaceService
# ═══════════════════════════════════════════════════════════════════════════
class MarketplaceService:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    def _listing_code(self) -> str:
        date_str = datetime.now(tz=timezone.utc).strftime("%Y%m%d")
        return f"LST-{date_str}-{uuid.uuid4().hex[:4].upper()}"

    def _order_number(self) -> str:
        date_str = datetime.now(tz=timezone.utc).strftime("%Y%m%d")
        return f"PO-{date_str}-{uuid.uuid4().hex[:6].upper()}"

    async def create_listing(
        self, payload: MarketplaceListingRequest, seller_id: str
    ) -> MarketplaceListingResponse:
        # Validate lot exists and is available
        lot_result = await self._db.execute(
            select(InventoryLot)
            .where(InventoryLot.id == payload.inventory_lot_id)
            .options(selectinload(InventoryLot.category))
        )
        lot = lot_result.scalar_one_or_none()
        if not lot:
            raise HTTPException(status_code=404, detail="Inventory lot not found.")
        if lot.status != InventoryLotStatus.AVAILABLE:
            raise HTTPException(
                status_code=400,
                detail=f"Lot is not available for listing (status: {lot.status.value}).",
            )
        if payload.available_quantity_kg > lot.available_quantity_kg:
            raise HTTPException(
                status_code=400,
                detail="Listing quantity exceeds available lot quantity.",
            )

        # Get floor price
        pr_result = await self._db.execute(
            select(PricingRule).where(
                PricingRule.category_id == lot.category_id,
                PricingRule.purity_grade == lot.purity_grade,
                PricingRule.is_active.is_(True),
            ).order_by(PricingRule.effective_from.desc()).limit(1)
        )
        pricing = pr_result.scalar_one_or_none()
        floor_price = pricing.floor_price_per_kg if pricing else 0.01

        if payload.unit_price_per_kg < floor_price:
            raise HTTPException(
                status_code=400,
                detail=f"Unit price ₹{payload.unit_price_per_kg:.2f} is below floor ₹{floor_price:.2f}.",
            )

        co2_total = payload.available_quantity_kg * lot.category.carbon_offset_factor

        listing = MarketplaceListing(
            id=uuid.uuid4(),
            listing_code=self._listing_code(),
            seller_id=uuid.UUID(seller_id),
            inventory_lot_id=payload.inventory_lot_id,
            category_id=lot.category_id,
            title=payload.title,
            description=payload.description,
            purity_grade=lot.purity_grade,
            listing_type=payload.listing_type,
            available_quantity_kg=payload.available_quantity_kg,
            min_order_quantity_kg=payload.min_order_quantity_kg,
            unit_price_per_kg=payload.unit_price_per_kg,
            calculated_floor_price=floor_price,
            estimated_co2_offset_total=round(co2_total, 4),
            status=ListingStatus.ACTIVE,
            auction_ends_at=payload.auction_ends_at,
        )
        self._db.add(listing)
        lot.status = InventoryLotStatus.LISTED
        await self._db.flush()
        return await self._get_listing_response(listing.id)

    async def _get_listing_response(self, listing_id: uuid.UUID) -> MarketplaceListingResponse:
        result = await self._db.execute(
            select(MarketplaceListing)
            .where(MarketplaceListing.id == listing_id)
            .options(selectinload(MarketplaceListing.category))
        )
        lst = result.scalar_one()
        return MarketplaceListingResponse.model_validate(lst)

    async def list_active(
        self,
        category_id: Optional[int],
        grade: Optional[str],
        min_price: Optional[float],
        max_price: Optional[float],
        page: int,
        page_size: int,
    ) -> list[MarketplaceListingResponse]:
        q = (
            select(MarketplaceListing)
            .where(MarketplaceListing.status == ListingStatus.ACTIVE)
            .options(selectinload(MarketplaceListing.category))
        )
        if category_id:
            q = q.where(MarketplaceListing.category_id == category_id)
        if grade:
            q = q.where(MarketplaceListing.purity_grade == grade)
        if min_price is not None:
            q = q.where(MarketplaceListing.unit_price_per_kg >= min_price)
        if max_price is not None:
            q = q.where(MarketplaceListing.unit_price_per_kg <= max_price)

        q = q.order_by(MarketplaceListing.created_at.desc())
        q = q.offset((page - 1) * page_size).limit(page_size)
        result = await self._db.execute(q)
        return [MarketplaceListingResponse.model_validate(lst) for lst in result.scalars().all()]

    async def place_bid(self, payload: BidRequest, buyer_id: str) -> BidResponse:
        lst_result = await self._db.execute(
            select(MarketplaceListing).where(MarketplaceListing.id == payload.listing_id)
        )
        listing = lst_result.scalar_one_or_none()
        if not listing or listing.status != ListingStatus.ACTIVE:
            raise HTTPException(status_code=404, detail="Listing not found or inactive.")
        if payload.requested_quantity_kg < listing.min_order_quantity_kg:
            raise HTTPException(
                status_code=400,
                detail=f"Minimum order quantity is {listing.min_order_quantity_kg} kg.",
            )
        if payload.bid_price_per_kg < listing.calculated_floor_price:
            raise HTTPException(
                status_code=400,
                detail=f"Bid price is below floor price ₹{listing.calculated_floor_price:.2f}.",
            )

        bid = Bid(
            id=uuid.uuid4(),
            listing_id=payload.listing_id,
            buyer_id=uuid.UUID(buyer_id),
            bid_price_per_kg=payload.bid_price_per_kg,
            requested_quantity_kg=payload.requested_quantity_kg,
            total_bid_amount=round(payload.bid_price_per_kg * payload.requested_quantity_kg, 2),
            status=BidStatus.PENDING,
            valid_until=payload.valid_until,
        )
        self._db.add(bid)
        return BidResponse.model_validate(bid)

    async def checkout(self, payload: CheckoutRequest, buyer_id: str) -> PurchaseOrderResponse:
        """
        Create a PurchaseOrder with ACID inventory reservation.
        Uses SELECT FOR UPDATE to prevent overselling.
        """
        # Lock listing row
        lst_result = await self._db.execute(
            select(MarketplaceListing)
            .where(MarketplaceListing.id == payload.listing_id)
            .with_for_update()
        )
        listing = lst_result.scalar_one_or_none()
        if not listing or listing.status != ListingStatus.ACTIVE:
            raise HTTPException(status_code=404, detail="Listing not found or no longer active.")
        if payload.quantity_kg > listing.available_quantity_kg:
            raise HTTPException(
                status_code=400,
                detail=f"Requested {payload.quantity_kg} kg exceeds available {listing.available_quantity_kg} kg.",
            )
        if payload.quantity_kg < listing.min_order_quantity_kg:
            raise HTTPException(
                status_code=400,
                detail=f"Minimum order is {listing.min_order_quantity_kg} kg.",
            )

        unit_price = listing.unit_price_per_kg
        subtotal = round(payload.quantity_kg * unit_price, 2)
        platform_fee = round(subtotal * settings.platform_fee_percent / 100, 2)
        total = round(subtotal + platform_fee, 2)

        order = PurchaseOrder(
            id=uuid.uuid4(),
            order_number=self._order_number(),
            listing_id=payload.listing_id,
            buyer_id=uuid.UUID(buyer_id),
            seller_id=listing.seller_id,
            accepted_bid_id=payload.bid_id,
            quantity_kg=payload.quantity_kg,
            unit_price_per_kg=unit_price,
            subtotal_amount=subtotal,
            platform_fee_amount=platform_fee,
            total_gross_amount=total,
            payment_status=PaymentStatus.PENDING,
            fulfillment_status=FulfillmentStatus.PENDING,
        )
        self._db.add(order)

        # Deduct from listing
        listing.available_quantity_kg = round(listing.available_quantity_kg - payload.quantity_kg, 4)
        if listing.available_quantity_kg <= 0:
            listing.status = ListingStatus.SOLD_OUT

        return PurchaseOrderResponse.model_validate(order)


# ═══════════════════════════════════════════════════════════════════════════
# PricingService
# ═══════════════════════════════════════════════════════════════════════════
class PricingService:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def get_quote(
        self,
        category_id: int,
        purity_grade: str,
        moisture_content_percent: float,
        contamination_percent: float,
    ) -> PricingQuoteResponse:
        from app.models import WasteCategory
        from ai_engine.pricing_engine import compute_price_quote

        cat_result = await self._db.execute(
            select(WasteCategory).where(WasteCategory.id == category_id)
        )
        category = cat_result.scalar_one_or_none()
        if not category:
            raise HTTPException(status_code=404, detail="Category not found.")

        pr_result = await self._db.execute(
            select(PricingRule).where(
                PricingRule.category_id == category_id,
                PricingRule.purity_grade == purity_grade,
                PricingRule.is_active.is_(True),
            ).order_by(PricingRule.effective_from.desc()).limit(1)
        )
        pricing = pr_result.scalar_one_or_none()
        if not pricing:
            raise HTTPException(
                status_code=404,
                detail=f"No active pricing rule for category {category_id} grade {purity_grade}.",
            )

        quote = compute_price_quote(
            base_benchmark=pricing.base_benchmark_price_per_kg,
            floor_price=pricing.floor_price_per_kg,
            ceiling_price=pricing.ceiling_price_per_kg,
            moisture_content_percent=moisture_content_percent,
            contamination_percent=contamination_percent,
            moisture_penalty=pricing.moisture_penalty_multiplier,
            contamination_penalty=pricing.contamination_penalty_multiplier,
            grade=purity_grade,
        )

        return PricingQuoteResponse(
            category_code=category.code,
            purity_grade=purity_grade,
            base_benchmark_price_per_kg=quote.base_benchmark_price_per_kg,
            floor_price_per_kg=quote.floor_price_per_kg,
            ceiling_price_per_kg=quote.ceiling_price_per_kg,
            moisture_penalty_applied=quote.moisture_penalty_applied,
            contamination_penalty_applied=quote.contamination_penalty_applied,
            effective_price_per_kg=quote.effective_price_per_kg,
            effective_from=pricing.effective_from,
        )


# ═══════════════════════════════════════════════════════════════════════════
# PaymentService
# ═══════════════════════════════════════════════════════════════════════════
class PaymentService:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def process_mock_webhook(self, payload: MockWebhookRequest) -> MockWebhookResponse:
        import asyncio
        await asyncio.sleep(settings.mock_payment_delay_ms / 1000)

        if payload.order_type == "purchase_order":
            result = await self._db.execute(
                select(PurchaseOrder).where(PurchaseOrder.id == payload.order_id).with_for_update()
            )
            order = result.scalar_one_or_none()
            if not order:
                raise HTTPException(status_code=404, detail="Purchase order not found.")
            prev = order.payment_status.value
            if payload.event == "PAYMENT_AUTHORIZED":
                order.payment_status = PaymentStatus.ESCROW_HELD
                order.payment_gateway_ref = payload.utr_reference
            elif payload.event == "PAYMENT_FAILED":
                order.payment_status = PaymentStatus.FAILED
            elif payload.event == "PAYMENT_REFUNDED":
                order.payment_status = PaymentStatus.REFUNDED
            return MockWebhookResponse(
                order_id=order.id, previous_status=prev,
                new_status=order.payment_status.value,
                message="Purchase order payment updated.",
            )

        # eco_order
        result = await self._db.execute(
            select(EcoOrder).where(EcoOrder.id == payload.order_id).with_for_update()
        )
        order = result.scalar_one_or_none()
        if not order:
            raise HTTPException(status_code=404, detail="Eco order not found.")
        prev = order.payment_status.value
        if payload.event == "PAYMENT_AUTHORIZED":
            order.payment_status = PaymentStatus.COMPLETED
        elif payload.event == "PAYMENT_FAILED":
            order.payment_status = PaymentStatus.FAILED
        return MockWebhookResponse(
            order_id=order.id, previous_status=prev,
            new_status=order.payment_status.value,
            message="Eco order payment updated.",
        )

    async def release_escrow(self, order_id: uuid.UUID) -> MockWebhookResponse:
        result = await self._db.execute(
            select(PurchaseOrder).where(PurchaseOrder.id == order_id).with_for_update()
        )
        order = result.scalar_one_or_none()
        if not order:
            raise HTTPException(status_code=404, detail="Purchase order not found.")
        if order.payment_status != PaymentStatus.ESCROW_HELD:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot release escrow from status '{order.payment_status.value}'.",
            )
        prev = order.payment_status.value
        order.payment_status = PaymentStatus.RELEASED
        order.fulfillment_status = FulfillmentStatus.DELIVERED
        return MockWebhookResponse(
            order_id=order.id, previous_status=prev,
            new_status=order.payment_status.value, message="Escrow released.",
        )


# ═══════════════════════════════════════════════════════════════════════════
# RewardService
# ═══════════════════════════════════════════════════════════════════════════
class RewardService:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def get_wallet(self, user_id: str) -> RewardWalletResponse:
        result = await self._db.execute(
            select(RewardWallet).where(RewardWallet.user_id == uuid.UUID(user_id))
        )
        wallet = result.scalar_one_or_none()
        if not wallet:
            raise HTTPException(status_code=404, detail="Reward wallet not found.")
        return RewardWalletResponse.model_validate(wallet)

    async def credit_intake_points(
        self, user_id: str, intake_id: uuid.UUID, weight_kg: float, grade: str
    ) -> None:
        """
        Credit green points for a verified intake. Uses SELECT FOR UPDATE.
        """
        grade_points = {
            "GRADE_A": settings.points_per_kg_grade_a,
            "GRADE_B": settings.points_per_kg_grade_b,
            "GRADE_C": settings.points_per_kg_grade_c,
        }
        pts_per_kg = grade_points.get(grade, 0)
        if pts_per_kg == 0:
            return

        points = int(weight_kg * pts_per_kg)
        if points <= 0:
            return

        result = await self._db.execute(
            select(RewardWallet)
            .where(RewardWallet.user_id == uuid.UUID(user_id))
            .with_for_update()
        )
        wallet = result.scalar_one_or_none()
        if not wallet:
            return

        wallet.available_points += points
        wallet.lifetime_earned += points
        wallet.updated_at = datetime.now(tz=timezone.utc)

        tx = RewardTransaction(
            wallet_id=wallet.id,
            intake_id=intake_id,
            points_delta=points,
            transaction_type=RewardTransactionType.INTAKE_CREDIT,
            description=f"Green points for {weight_kg:.1f} kg {grade} verified waste",
            created_at=datetime.now(tz=timezone.utc),
        )
        self._db.add(tx)

    async def list_transactions(
        self, user_id: str, page: int, page_size: int
    ) -> list[RewardTransactionResponse]:
        wallet_result = await self._db.execute(
            select(RewardWallet).where(RewardWallet.user_id == uuid.UUID(user_id))
        )
        wallet = wallet_result.scalar_one_or_none()
        if not wallet:
            return []

        result = await self._db.execute(
            select(RewardTransaction)
            .where(RewardTransaction.wallet_id == wallet.id)
            .order_by(RewardTransaction.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        return [RewardTransactionResponse.model_validate(tx) for tx in result.scalars().all()]


# ═══════════════════════════════════════════════════════════════════════════
# EcoStoreService
# ═══════════════════════════════════════════════════════════════════════════
class EcoStoreService:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    def _eco_order_number(self) -> str:
        date_str = datetime.now(tz=timezone.utc).strftime("%Y%m%d")
        return f"ECO-{date_str}-{uuid.uuid4().hex[:6].upper()}"

    async def list_products(self, category: Optional[str] = None) -> list[EcoProductResponse]:
        q = select(EcoProduct).where(EcoProduct.stock_quantity > 0)
        if category:
            q = q.where(EcoProduct.category == category)
        result = await self._db.execute(q.order_by(EcoProduct.is_featured.desc()))
        return [EcoProductResponse.model_validate(p) for p in result.scalars().all()]

    async def get_product(self, product_id: uuid.UUID) -> EcoProductResponse:
        result = await self._db.execute(
            select(EcoProduct).where(EcoProduct.id == product_id)
        )
        product = result.scalar_one_or_none()
        if not product:
            raise HTTPException(status_code=404, detail="Product not found.")
        return EcoProductResponse.model_validate(product)

    async def validate_cart(
        self, payload: CartValidateRequest, user_id: str
    ) -> CartValidateResponse:
        # Get wallet
        wallet_result = await self._db.execute(
            select(RewardWallet).where(RewardWallet.user_id == uuid.UUID(user_id))
        )
        wallet = wallet_result.scalar_one_or_none()

        # Compute gross amount
        items_out = []
        gross = 0.0
        for item in payload.items:
            prod_result = await self._db.execute(
                select(EcoProduct).where(EcoProduct.id == item.product_id)
            )
            product = prod_result.scalar_one_or_none()
            if not product:
                raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found.")
            if item.quantity > product.stock_quantity:
                raise HTTPException(
                    status_code=400,
                    detail=f"Insufficient stock for '{product.title}'.",
                )
            line_total = product.price_fiat * item.quantity
            gross += line_total
            items_out.append({
                "product_id": str(product.id),
                "title": product.title,
                "quantity": item.quantity,
                "unit_price": product.price_fiat,
                "line_total": line_total,
            })

        # Points calculation — max 50% of cart
        max_redeemable_points = int(
            (gross * settings.max_redemption_percent / 100) / settings.points_to_currency_rate
        )
        available_pts = wallet.available_points if wallet else 0
        points_to_redeem = min(payload.points_to_redeem, max_redeemable_points, available_pts)
        discount = round(points_to_redeem * settings.points_to_currency_rate, 2)
        net = round(max(0.0, gross - discount), 2)

        return CartValidateResponse(
            items=items_out,
            gross_amount=round(gross, 2),
            points_to_redeem=points_to_redeem,
            points_discount_amount=discount,
            net_payable_amount=net,
            max_redeemable_points=max_redeemable_points,
        )

    async def checkout(
        self, payload: EcoCheckoutRequest, user_id: str
    ) -> EcoOrderResponse:
        validated = await self.validate_cart(
            CartValidateRequest(items=payload.items, points_to_redeem=payload.points_to_redeem),
            user_id=user_id,
        )

        # Deduct stock (SELECT FOR UPDATE per product)
        for item in payload.items:
            result = await self._db.execute(
                select(EcoProduct).where(EcoProduct.id == item.product_id).with_for_update()
            )
            product = result.scalar_one()
            product.stock_quantity -= item.quantity

        # Deduct points
        if validated.points_to_redeem > 0:
            wallet_result = await self._db.execute(
                select(RewardWallet)
                .where(RewardWallet.user_id == uuid.UUID(user_id))
                .with_for_update()
            )
            wallet = wallet_result.scalar_one()
            wallet.available_points -= validated.points_to_redeem
            wallet.lifetime_redeemed += validated.points_to_redeem
            wallet.updated_at = datetime.now(tz=timezone.utc)
            tx = RewardTransaction(
                wallet_id=wallet.id,
                points_delta=-validated.points_to_redeem,
                transaction_type=RewardTransactionType.STORE_REDEMPTION,
                description=f"Points redeemed at Eco-Store order {self._eco_order_number()}",
                created_at=datetime.now(tz=timezone.utc),
            )
            self._db.add(tx)

        order = EcoOrder(
            id=uuid.uuid4(),
            order_number=self._eco_order_number(),
            user_id=uuid.UUID(user_id),
            gross_amount=validated.gross_amount,
            points_redeemed=validated.points_to_redeem,
            points_discount_amount=validated.points_discount_amount,
            net_payable_amount=validated.net_payable_amount,
            payment_status=PaymentStatus.PENDING,
            shipping_address=payload.shipping_address,
            items_snapshot=validated.items,
            created_at=datetime.now(tz=timezone.utc),
        )
        self._db.add(order)
        return EcoOrderResponse.model_validate(order)


# ═══════════════════════════════════════════════════════════════════════════
# AnalyticsService
# ═══════════════════════════════════════════════════════════════════════════
class AnalyticsService:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def get_public_metrics(self) -> PublicImpactMetrics:
        from sqlalchemy import func
        from app.models import User, Supplier

        # Total verified weight
        wt_result = await self._db.execute(
            select(func.coalesce(func.sum(WasteIntake.verified_weight_kg), 0.0))
            .where(WasteIntake.status.in_(["VERIFIED"]))
        )
        total_kg = float(wt_result.scalar() or 0.0)

        # Active listings
        lst_result = await self._db.execute(
            select(func.count()).where(MarketplaceListing.status == ListingStatus.ACTIVE)
        )
        active_listings = int(lst_result.scalar() or 0)

        # Active suppliers
        sup_result = await self._db.execute(
            select(func.count()).where(Supplier.verification_status == VerificationStatus.VERIFIED)
        )
        active_suppliers = int(sup_result.scalar() or 0)

        # GMV (sum of completed order totals)
        po_result = await self._db.execute(
            select(func.coalesce(func.sum(PurchaseOrder.total_gross_amount), 0.0))
            .where(PurchaseOrder.payment_status == PaymentStatus.RELEASED)
        )
        gmv = float(po_result.scalar() or 0.0)

        return PublicImpactMetrics(
            total_waste_diverted_tonnes=round(total_kg / 1000, 2),
            total_co2_saved_kg=round(total_kg * 1.5, 2),
            total_supplier_payouts=round(gmv * 0.975, 2),  # after platform fee
            active_suppliers=active_suppliers,
            active_listings=active_listings,
        )

    async def supplier_dashboard(self, user_id: str) -> SupplierDashboardResponse:
        from app.models import IntakeStatus

        sup_result = await self._db.execute(
            select(Supplier).where(Supplier.user_id == uuid.UUID(user_id))
        )
        supplier = sup_result.scalar_one_or_none()
        if not supplier:
            raise HTTPException(status_code=404, detail="Supplier profile not found.")

        intakes_result = await self._db.execute(
            select(WasteIntake).where(WasteIntake.supplier_id == supplier.id)
        )
        intakes = intakes_result.scalars().all()

        total_submitted = sum(i.declared_weight_kg for i in intakes)
        total_verified = sum(
            (i.verified_weight_kg or 0.0)
            for i in intakes if i.status == IntakeStatus.VERIFIED
        )
        co2_saved = total_verified * 1.5

        status_counts: dict[str, int] = {}
        for i in intakes:
            key = i.status.value
            status_counts[key] = status_counts.get(key, 0) + 1

        wallet_result = await self._db.execute(
            select(RewardWallet).where(RewardWallet.user_id == uuid.UUID(user_id))
        )
        wallet = wallet_result.scalar_one_or_none()

        return SupplierDashboardResponse(
            total_intakes=len(intakes),
            total_kg_submitted=round(total_submitted, 2),
            total_kg_verified=round(total_verified, 2),
            total_co2_saved_kg=round(co2_saved, 2),
            intake_status_counts=status_counts,
            reward_points_available=wallet.available_points if wallet else 0,
            reward_lifetime_earned=wallet.lifetime_earned if wallet else 0,
        )

    async def recycler_dashboard(self, user_id: str) -> RecyclerDashboardResponse:
        bids_result = await self._db.execute(
            select(func.count()).where(
                Bid.buyer_id == uuid.UUID(user_id),
                Bid.status == BidStatus.PENDING,
            )
        )
        active_bids = int(bids_result.scalar() or 0)

        orders_result = await self._db.execute(
            select(PurchaseOrder).where(PurchaseOrder.buyer_id == uuid.UUID(user_id))
        )
        orders = orders_result.scalars().all()

        total_kg = sum(o.quantity_kg for o in orders if o.fulfillment_status == FulfillmentStatus.DELIVERED)
        escrow = sum(o.total_gross_amount for o in orders if o.payment_status == PaymentStatus.ESCROW_HELD)
        spent = sum(o.total_gross_amount for o in orders if o.payment_status == PaymentStatus.RELEASED)

        return RecyclerDashboardResponse(
            active_bids=active_bids,
            total_purchased_kg=round(total_kg, 2),
            escrow_held_amount=round(escrow, 2),
            total_spent_amount=round(spent, 2),
            active_transits=0,  # TODO: join transit table
        )

    async def admin_dashboard(self) -> AdminDashboardResponse:
        from app.models import User, IntakeStatus

        gmv_result = await self._db.execute(
            select(func.coalesce(func.sum(PurchaseOrder.total_gross_amount), 0.0))
        )
        gmv = float(gmv_result.scalar() or 0.0)

        wt_result = await self._db.execute(
            select(func.coalesce(func.sum(WasteIntake.verified_weight_kg), 0.0))
        )
        total_kg = float(wt_result.scalar() or 0.0)

        flagged_result = await self._db.execute(
            select(func.count()).where(WasteIntake.status == "FLAGGED_DISCREPANCY")
        )
        flagged = int(flagged_result.scalar() or 0)

        users_result = await self._db.execute(select(func.count(User.id)))
        total_users = int(users_result.scalar() or 0)

        sup_result = await self._db.execute(select(func.count(Supplier.id)))
        total_suppliers = int(sup_result.scalar() or 0)

        return AdminDashboardResponse(
            platform_gmv=round(gmv, 2),
            total_waste_processed_tonnes=round(total_kg / 1000, 4),
            active_transit_count=0,
            flagged_intakes=flagged,
            total_registered_users=total_users,
            total_suppliers=total_suppliers,
        )


# ═══════════════════════════════════════════════════════════════════════════
# AIAssessmentService
# ═══════════════════════════════════════════════════════════════════════════
class AIAssessmentService:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def get_by_intake_id(self, intake_id: uuid.UUID) -> WasteAssessmentResponse:
        result = await self._db.execute(
            select(WasteAssessment).where(WasteAssessment.intake_id == intake_id)
        )
        assessment = result.scalar_one_or_none()
        if not assessment:
            raise HTTPException(
                status_code=404,
                detail="AI assessment not yet available for this intake. It may still be processing.",
            )
        return WasteAssessmentResponse.model_validate(assessment)

    async def enqueue_assessment(self, intake_id: uuid.UUID) -> None:
        from app.workers.tasks import run_ai_assessment
        run_ai_assessment.delay(str(intake_id))
