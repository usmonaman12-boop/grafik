import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pg from "pg";
import path from "path";
import {fileURLToPath} from "url";
dotenv.config();
const {Pool}=pg;
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_URL&&!process.env.DATABASE_URL.includes("localhost")?{rejectUnauthorized:false}:false});
const app=express(); app.use(cors()); app.use(express.json());
const q=(sql,p=[])=>pool.query(sql,p);

async function init(){
 await q(`CREATE TABLE IF NOT EXISTS users(id SERIAL PRIMARY KEY,username TEXT UNIQUE NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('admin','teacher','student')),name TEXT NOT NULL,created_at TIMESTAMPTZ DEFAULT NOW());
 CREATE TABLE IF NOT EXISTS groups(id SERIAL PRIMARY KEY,name TEXT UNIQUE NOT NULL,teacher_id INTEGER REFERENCES users(id) ON DELETE SET NULL);
 CREATE TABLE IF NOT EXISTS students(id SERIAL PRIMARY KEY,name TEXT NOT NULL,username TEXT UNIQUE NOT NULL,password TEXT NOT NULL DEFAULT '1234',group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,score INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS score_events(id SERIAL PRIMARY KEY,student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,type TEXT NOT NULL,points INTEGER NOT NULL,created_at TIMESTAMPTZ DEFAULT NOW());`);
 const c=await q("SELECT COUNT(*)::int count FROM users");
 if(!c.rows[0].count){
  const t=await q("INSERT INTO users(username,password,role,name) VALUES($1,$2,'teacher',$3) RETURNING id",["anvar","1234","Anvar Teacher"]);
  await q("INSERT INTO users(username,password,role,name) VALUES('admin','1234','admin','Administrator')");
  const g=await q("INSERT INTO groups(name,teacher_id) VALUES($1,$2) RETURNING id",["Frontend 11",t.rows[0].id]);
  await q("INSERT INTO students(name,username,password,group_id) VALUES($1,$2,$3,$4)",["Usmon Aman","usmon","1234",g.rows[0].id]);
 }
}
app.get("/api/health",async(_,res)=>{try{await q("SELECT 1");res.json({ok:true,database:"connected"})}catch(e){res.status(500).json({ok:false,error:e.message})}});
app.post("/api/login",async(req,res)=>{const r=await q("SELECT id,username,role,name FROM users WHERE username=$1 AND password=$2",[req.body.username,req.body.password]);if(!r.rowCount)return res.status(401).json({error:"Login yoki parol noto'g'ri"});res.json(r.rows[0])});
app.get("/api/admin",async(_,res)=>{const teachers=await q("SELECT id,username,name FROM users WHERE role='teacher' ORDER BY id DESC");const groups=await q("SELECT g.id,g.name,g.teacher_id,u.name teacher_name FROM groups g LEFT JOIN users u ON u.id=g.teacher_id ORDER BY g.id DESC");const students=await q("SELECT s.id,s.name,s.username,s.group_id,s.score,g.name group_name FROM students s LEFT JOIN groups g ON g.id=s.group_id ORDER BY s.id DESC");res.json({teachers:teachers.rows,groups:groups.rows,students:students.rows})});
app.post("/api/teachers",async(req,res)=>{try{const r=await q("INSERT INTO users(username,password,role,name) VALUES($1,$2,'teacher',$3) RETURNING id,username,name",[req.body.username,req.body.password||"1234",req.body.name]);res.json(r.rows[0])}catch(e){res.status(400).json({error:e.message})}});
app.post("/api/groups",async(req,res)=>{try{const r=await q("INSERT INTO groups(name,teacher_id) VALUES($1,$2) RETURNING *",[req.body.name,req.body.teacher_id||null]);res.json(r.rows[0])}catch(e){res.status(400).json({error:e.message})}});
app.post("/api/students",async(req,res)=>{try{const r=await q("INSERT INTO students(name,username,password,group_id) VALUES($1,$2,$3,$4) RETURNING *",[req.body.name,req.body.username,req.body.password||"1234",req.body.group_id||null]);res.json(r.rows[0])}catch(e){res.status(400).json({error:e.message})}});
app.get("/api/teacher/:id",async(req,res)=>{const groups=await q("SELECT id,name,teacher_id FROM groups WHERE teacher_id=$1 ORDER BY id",[req.params.id]);const students=await q("SELECT s.id,s.name,s.username,s.group_id,s.score,g.name group_name FROM students s LEFT JOIN groups g ON g.id=s.group_id WHERE g.teacher_id=$1 ORDER BY s.id",[req.params.id]);res.json({groups:groups.rows,students:students.rows})});
app.get("/api/student/:id",async(req,res)=>{const s=await q("SELECT s.id,s.name,s.username,s.score,g.name group_name FROM students s LEFT JOIN groups g ON g.id=s.group_id WHERE s.id=$1",[req.params.id]);if(!s.rowCount)return res.status(404).json({error:"Student topilmadi"});const e=await q("SELECT id,type,points,created_at FROM score_events WHERE student_id=$1 ORDER BY id DESC",[req.params.id]);res.json({student:s.rows[0],events:e.rows})});
async function addScore(id,type,points){await q("INSERT INTO score_events(student_id,type,points) VALUES($1,$2,$3)",[id,type,points]);return q("UPDATE students SET score=score+$1 WHERE id=$2 RETURNING id,score",[points,id])}
app.post("/api/attendance",async(req,res)=>{const p=req.body.present?3:0;res.json(p?(await addScore(req.body.student_id,"attendance",p)).rows[0]:(await q("SELECT id,score FROM students WHERE id=$1",[req.body.student_id])).rows[0])});
app.post("/api/homework",async(req,res)=>{const p={"Bor":5,"Chala":3,"Yo'q":1}[req.body.status];if(p===undefined)return res.status(400).json({error:"Noto'g'ri status"});res.json((await addScore(req.body.student_id,"homework:"+req.body.status,p)).rows[0])});
app.post("/api/score",async(req,res)=>{const p=Number(req.body.points);if(!Number.isFinite(p))return res.status(400).json({error:"Ball son bo'lishi kerak"});res.json((await addScore(req.body.student_id,"extra",p)).rows[0])});
const __dirname=path.dirname(fileURLToPath(import.meta.url));app.use(express.static(path.join(__dirname,"../client/dist")));app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"../client/dist/index.html")));
const port=process.env.PORT||3000;init().then(()=>app.listen(port,()=>console.log("EduScore:",port))).catch(e=>{console.error(e);process.exit(1)});
