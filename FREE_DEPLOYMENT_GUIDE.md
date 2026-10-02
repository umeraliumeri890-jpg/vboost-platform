# 🌐 100% FREE Production Launch Guide (Zero Cost Blueprint)

Is guide ke zariye aap apna poora **Microtask / VBoost Platform** internet par **bilkul FREE ($0)** live launch kar sakte hain. Koi credit card ya payment ki zaroorat nahi hai.

---

## 🛠️ Free Tech Stack Overview

| Component | Platform | Free Plan Limits | Cost |
|---|---|---|---|
| **Database** | **MongoDB Atlas** | 512 MB Storage, Auto Backups, SSL | **$0 / month** |
| **Backend API** | **Render.com** | 750 free compute hours/month, Auto HTTPS | **$0 / month** |
| **Frontend UI** | **Vercel** | Global CDN, Unlimited bandwidth, Auto HTTPS | **$0 / month** |
| **Screenshot Storage** | **Cloudinary** | 25 GB storage & transformations | **$0 / month** |
| **Source Code** | **GitHub** | Unlimited public / private repositories | **$0 / month** |

---

## 🚀 Step 1: Code Ko GitHub Par Upload Karein

Apne computer par terminal open karein aur project directory mein ja kar yeh commands run karein:

```bash
cd C:\Users\windows\.gemini\antigravity\scratch\microtask-platform

# Git initialize karein
git init

# Files add karein (.gitignore pehle se sensitive .env ko protect karega)
git add .
git commit -m "Initial VBoost Microtask Platform Commit"

# GitHub par naya repo banayein (e.g. 'vboost-platform') aur link karein:
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/vboost-platform.git
git push -u origin main
```

---

## 🍃 Step 2: Database (MongoDB Atlas) — Pehle Se Tayyar Hai

Aapka cluster pehle se ready hai:
* **Cluster:** `cluster0.titjb21.mongodb.net`
* **URI:** `mongodb+srv://umeralibrand890_db_user:<YOUR_PASSWORD>@cluster0.titjb21.mongodb.net/microtask_platform?appName=Cluster0`

> ⚠️ **Important:** MongoDB Atlas dashboard par ja kar **Network Access** mein check karein ke IP Access list mein `0.0.0.0/0` (Allow access from anywhere) add ho, taake Render cloud server database se connect ho sake.

---

## ☁️ Step 3: Cloudinary Free Account (Screenshots Ke Liye)

1. [https://cloudinary.com](https://cloudinary.com) par free account banayein.
2. Dashboard par aapko 3 cheezein milengi:
   * **Cloud Name**
   * **API Key**
   * **API Secret**
3. Yeh 3 values Step 4 mein use hongi.

---

## 🖥️ Step 4: Backend Deploy Karein (Render.com Par)

1. [https://render.com](https://render.com) par free sign up karein (Sign in with GitHub).
2. **New +** button par click karein aur **Web Service** select karein.
3. Apna GitHub repository (`vboost-platform`) select karein.
4. Settings fill karein:
   * **Name:** `vboost-api`
   * **Region:** Frankfurt ya Singapore (closest to users)
   * **Branch:** `main`
   * **Root Directory:** (Khaali chor dein / leave blank)
   * **Runtime:** `Node`
   * **Build Command:** `npm install`
   * **Start Command:** `npm start`
   * **Instance Type:** `Free`
5. **Environment Variables** section mein yeh keys add karein:
   ```env
   NODE_ENV = production
   PORT = 5000
   MONGODB_URI = mongodb+srv://umeralibrand890_db_user:<PASSWORD>@cluster0.titjb21.mongodb.net/microtask_platform?appName=Cluster0
   JWT_SECRET = super_strong_random_secret_here_12345
   JWT_REFRESH_SECRET = another_strong_random_secret_here_67890
   WEBHOOK_SECRET = webhook_hmac_secret_key_vboost
   USE_CLOUDINARY = true
   CLOUDINARY_CLOUD_NAME = your_cloudinary_cloud_name
   CLOUDINARY_API_KEY = your_cloudinary_api_key
   CLOUDINARY_API_SECRET = your_cloudinary_api_secret
   PLATFORM_FEE_PERCENT = 15
   MIN_PAYOUT_PER_TASK = 0.001
   FRONTEND_URL = *
   ```
6. **Create Web Service** par click karein.
7. Render aapko ek live backend URL dega (e.g. `https://vboost-api.onrender.com`).
   * Test URL: `https://vboost-api.onrender.com/api/health` -> `{"status":"ok"}` return karega!

---

## ⚡ Step 5: Frontend Deploy Karein (Vercel Par)

1. [https://vercel.com](https://vercel.com) par free sign up karein (Continue with GitHub).
2. **Add New...** -> **Project** par click karein.
3. Apna GitHub repository (`vboost-platform`) import karein.
4. Configuration screen par:
   * **Framework Preset:** `Next.js` (auto-detected)
   * **Root Directory:** **Edit** par click karein aur `frontend` select karein!
5. **Environment Variables** add karein:
   ```env
   NEXT_PUBLIC_API_URL = https://vboost-api.onrender.com/api/v1
   ```
   *(Render se mila hua backend URL yahan paste karein aur aakhir mein `/api/v1` lagayein).*
6. **Deploy** button par click karein!
7. 60 seconds ke andar aapka frontend live ho jayega:
   * **Live Web URL:** `https://vboost-platform.vercel.app` (with Free Global SSL 🔒).

---

## 🔗 Step 6: Final Connection (CORS Update)

Vercel deployment ke baad:
1. Render.com dashboard par `vboost-api` ki settings mein jayein.
2. `FRONTEND_URL` environment variable ko update karke apna Vercel domain daal dein:
   ```env
   FRONTEND_URL = https://vboost-platform.vercel.app
   ```
3. Save changes karein. Render auto-restart ho jayega.

---

## 🎉 Mubarak Ho! Aapki Web Platform Live Hai

* **Visitors & Workers:** `https://vboost-platform.vercel.app` par register karenge aur tasks complete karke paise kamayenge.
* **Advertisers:** Campaigns banayenge aur target views/likes hasil karenge.
* **Super Admin:** `https://vboost-platform.vercel.app/admin` par login karke (`admin@microtask.com` / `Password123!`) live withdrawals approve karega aur platform monitor karega!
