import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const resources = {
  en: {
    translation: {
      brand: "Circular Waste Marketplace",
      tagline: "AI-Powered Feedstock Exchange & Circular Economy Platform",
      roles: {
        GENERATOR: "Supplier / Generator",
        RECYCLER: "Recycler & Sorter",
        LOGISTICS: "Logistics Driver",
        ADMIN: "Operations Admin",
      },
      nav: {
        dashboard: "Overview",
        intake: "Submit Waste",
        pickups: "Pickup Schedule",
        tracking: "Live Tracking",
        sorting: "Sorting & Quality",
        marketplace: "Feedstock Exchange",
        store: "Eco Products",
        rewards: "Green Rewards",
        logout: "Sign Out",
      },
      intake: {
        title: "Segregated Waste Consignment Intake",
        uploadPrompt: "Drag & drop batch photos or click to browse",
        analyzing: "Running AI Quality Gate (Laplacian blur, brightness, duplicate checks)...",
        declaredWeight: "Declared Weight (kg)",
        category: "Material Category",
        dynamicQuote: "Dynamic Price Estimate",
        submit: "Submit Consignment",
      },
      marketplace: {
        title: "Industrial Recycled Feedstock Exchange",
        subtitle: "Verified post-consumer and industrial segregated lots with custody audit trails",
        filterGrade: "Purity Grade",
        filterCategory: "Material Category",
        buyNow: "Hold & Purchase",
        bid: "Place Bid",
        pricePerKg: "₹/kg",
      },
      rewards: {
        title: "Green Loyalty Rewards",
        points: "Eco-Points Balance",
        streak: "Consecutive Day Recycling Streak",
        co2Saved: "CO₂e Avoided",
        redeem: "Redeem Voucher",
      },
    },
  },
  hi: {
    translation: {
      brand: "सर्कुलर अपशिष्ट बाज़ार",
      tagline: "एआई-संचालित पुनर्चक्रण कच्चा माल विनिमय मंच",
      roles: {
        GENERATOR: "अपशिष्ट आपूर्तिकर्ता",
        RECYCLER: "रीसाइक्लर और सॉर्टर",
        LOGISTICS: "ड्राइवर / लॉजिस्टिक्स",
        ADMIN: "प्रशासक",
      },
      nav: {
        dashboard: "डैशबोर्ड",
        intake: "कचरा जमा करें",
        pickups: "पिकअप अनुसूची",
        tracking: "लाइव ट्रैकिंग",
        sorting: "सॉर्टिंग और गुणवत्ता",
        marketplace: "कच्चा माल बाज़ार",
        store: "इको उत्पाद",
        rewards: "हरित पुरस्कार",
        logout: "लॉगआउट",
      },
      intake: {
        title: "अपशिष्ट खेप जमा करें",
        uploadPrompt: "फोटो अपलोड करें या फ़ाइल चुनें",
        analyzing: "एआई गुणवत्ता परीक्षण जारी है...",
        declaredWeight: "घोषित वजन (किग्रा)",
        category: "अपशिष्ट श्रेणी",
        dynamicQuote: "अनुमानित मूल्य",
        submit: "खेप दर्ज करें",
      },
      marketplace: {
        title: "औद्योगिक पुनर्चक्रित कच्चा माल बाज़ार",
        subtitle: "सत्यापित और गुणवत्ता-परीक्षित अपशिष्ट सामग्री",
        filterGrade: "शुद्धता ग्रेड",
        filterCategory: "सामग्री श्रेणी",
        buyNow: "सुरक्षित खरीदें",
        bid: "बोली लगाएं",
        pricePerKg: "₹/किग्रा",
      },
      rewards: {
        title: "हरित लॉयल्टी पुरस्कार",
        points: "इको-पॉइंट्स बैलेंस",
        streak: "रीसाइक्लिंग स्ट्रीक",
        co2Saved: "CO₂e की बचत",
        redeem: "वाउचर रिडीम करें",
      },
    },
  },
};

i18n.use(initReactI18next).init({
  resources,
  lng: "en",
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
