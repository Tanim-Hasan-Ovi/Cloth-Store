# AVEN Apparel — E-Commerce Web Application

AVEN is a minimalist, full-stack e-commerce web application designed for modern lifestyle and apparel brands. The platform provides automated inventory reservations, email notifications, role-based administration with safe demo controls, and customer order management.

* **Live Demo:** [https://cloth-store-ifrs75d9f-tanim-hasan-ovis-projects.vercel.app](https://cloth-store-ifrs75d9f-tanim-hasan-ovis-projects.vercel.app)
* **Demo Admin Access:** Use the one-click demo access button available directly on the login page *(includes read-only protection to prevent modifications to the live catalog)*.

---

## Core Features

* **Smart Cart & Inventory:**
  * Automated temporary cart reservations to prevent overselling during checkout.
  * Real-time stock status calculations and low-stock indicators.
* **Order Lifecycle & Notification:**
  * Automated HTML order confirmation emails sent directly to the customer via Nodemailer.
  * Customer portal to track active orders and cancel pending orders with automatic stock restoral.
* **Authentication & Recovery:** 
  * Google OAuth2 one-tap integration alongside custom email/password authentication.
  * 6-digit email OTP verification for secure password reset.
* **Administrative Control & Safe Demo:**
  * Real-time order status updates (Pending, Processing, Shipped, Delivered, Cancelled).
  * Product catalog management with Cloudinary image integration.
  * One-click demo admin access with restricted read-only permissions for safety.

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | HTML5, Tailwind CSS, JavaScript (ES6+) |
| **Backend** | Node.js, Express.js |
| **Database** | MongoDB Atlas, Mongoose ODM |
| **Cloud & Media** | Cloudinary, Multer |
| **Email Service** | Nodemailer (Gmail SMTP) |
| **Deployment** | Vercel |

---

## Author

* **Developer:** TANIM HASAN OVI
