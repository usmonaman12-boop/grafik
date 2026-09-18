# EduScore Vue + PostgreSQL

Ma'lumotlar localStorage yoki data.json emas, PostgreSQL bazasida saqlanadi.

## Railway
PostgreSQL service qo'sh. Backend Variables ichida:
DATABASE_URL=${{Postgres.DATABASE_URL}}

Start Command:
npm start

## Lokal
server/.env:
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
PORT=3000

Keyin:
npm run install:all
npm start

Frontend dev:
npm --prefix client run dev

Demo:
admin / 1234
anvar / 1234
usmon / 1234
