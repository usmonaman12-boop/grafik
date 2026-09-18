# EduScore — Vue + Express

Bu loyiha o‘quvchilar davomat, uy vazifasi va ballarini boshqarish uchun tayyorlangan.

## Texnologiyalar
- Vue 3 + Vite
- Express
- JSON fayl orqali server-side saqlash
- Railway uchun tayyor

## Ishga tushirish

Terminalda loyiha papkasida:

```bash
npm install
npm run install:all
npm run dev
```

Frontend: http://localhost:5173  
Backend: http://localhost:3000

## Demo loginlar

Admin:
- login: `admin`
- parol: `1234`

Teacher:
- login: `anvar`
- parol: `1234`

## Muhim
Ma'lumotlar `server/data.json` ichida saqlanadi. Shu sababli brauzer localStorage'iga bog‘liq emas va boshqa qurilmadan API orqali ham bir xil ma'lumot olinadi.

Railwayda persistent storage kerak bo‘lsa, Volume ulash tavsiya qilinadi. Production uchun keyinchalik PostgreSQLga o'tkazish mumkin.
