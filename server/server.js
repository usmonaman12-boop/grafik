const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "data.json");

app.use(cors());
app.use(express.json());

function readDB() {
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function writeDB(db) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), "utf8");
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function attendanceScore(s) {
  return (s.attendance || []).reduce((sum, x) => sum + (x.present ? 3 : 0), 0);
}

function homeworkScore(s) {
  return (s.homework || []).reduce((sum, x) => {
    if (x.status === "bor") return sum + 5;
    if (x.status === "chala") return sum + 3;
    if (x.status === "yoq") return sum + 1;
    return sum;
  }, 0);
}

function totalScore(s) {
  return attendanceScore(s) + homeworkScore(s) + Number(s.extraScore || 0);
}

function decorateStudent(s) {
  return {
    ...s,
    totalScore: totalScore(s),
    attendanceScore: attendanceScore(s),
    homeworkScore: homeworkScore(s)
  };
}

function safeTeacher(t) {
  const { password, ...safe } = t;
  return safe;
}

function safeStudent(s) {
  const { password, ...safe } = s;
  return decorateStudent(safe);
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  const db = readDB();

  if (username === "admin" && password === "1234") {
    return res.json({ user: { id: 0, name: "Administrator", role: "admin" } });
  }

  const teacher = db.teachers.find(t => t.username === username && t.password === password);
  if (teacher) {
    return res.json({ user: { id: teacher.id, name: teacher.name, role: "teacher" } });
  }

  const student = db.students.find(s => s.username === username && s.password === password);
  if (student) {
    return res.json({ user: { id: student.id, name: student.name, role: "student" } });
  }

  return res.status(401).json({ error: "Login yoki parol noto‘g‘ri." });
});

app.get("/api/dashboard", (req, res) => {
  const db = readDB();
  const students = db.students.map(decorateStudent);
  res.json({
    teachers: db.teachers.length,
    groups: db.groups.length,
    students: students.length,
    totalScore: students.reduce((a, s) => a + s.totalScore, 0)
  });
});

app.get("/api/teachers", (req, res) => {
  const db = readDB();
  res.json(db.teachers.map(safeTeacher));
});

app.post("/api/teachers", (req, res) => {
  const { name, username, password } = req.body;
  if (!name || !username || !password) return res.status(400).json({ error: "Barcha maydonlarni to‘ldiring." });

  const db = readDB();
  if (db.teachers.some(t => t.username === username) || db.students.some(s => s.username === username)) {
    return res.status(400).json({ error: "Bu login band." });
  }

  const teacher = { id: Date.now(), name, username, password };
  db.teachers.push(teacher);
  writeDB(db);
  res.json(safeTeacher(teacher));
});

app.delete("/api/teachers/:id", (req, res) => {
  const id = Number(req.params.id);
  const db = readDB();
  db.teachers = db.teachers.filter(t => t.id !== id);
  db.groups.forEach(g => { if (g.teacherId === id) g.teacherId = null; });
  writeDB(db);
  res.json({ ok: true });
});

app.get("/api/groups", (req, res) => {
  const db = readDB();
  res.json(db.groups);
});

app.post("/api/groups", (req, res) => {
  const { name, teacherId } = req.body;
  if (!name || !teacherId) return res.status(400).json({ error: "Guruh nomi va o‘qituvchi kerak." });

  const db = readDB();
  const group = { id: Date.now(), name, teacherId: Number(teacherId) };
  db.groups.push(group);
  writeDB(db);
  res.json(group);
});

app.put("/api/groups/:id", (req, res) => {
  const id = Number(req.params.id);
  const db = readDB();
  const group = db.groups.find(g => g.id === id);
  if (!group) return res.status(404).json({ error: "Guruh topilmadi." });

  if (req.body.name) group.name = req.body.name;
  if (req.body.teacherId) group.teacherId = Number(req.body.teacherId);

  writeDB(db);
  res.json(group);
});

app.get("/api/students", (req, res) => {
  const db = readDB();
  res.json(db.students.map(safeStudent));
});

app.post("/api/students", (req, res) => {
  const { name, username, password, groupId } = req.body;
  if (!name || !username || !password || !groupId) {
    return res.status(400).json({ error: "Ism, login, parol va guruh kerak." });
  }

  const db = readDB();
  if (db.teachers.some(t => t.username === username) || db.students.some(s => s.username === username)) {
    return res.status(400).json({ error: "Bu login band." });
  }

  const student = {
    id: Date.now(),
    name,
    username,
    password,
    groupId: Number(groupId),
    attendance: [],
    homework: [],
    extraScore: 0
  };

  db.students.push(student);
  writeDB(db);
  res.json(safeStudent(student));
});

app.delete("/api/students/:id", (req, res) => {
  const id = Number(req.params.id);
  const db = readDB();
  db.students = db.students.filter(s => s.id !== id);
  writeDB(db);
  res.json({ ok: true });
});

app.get("/api/groups/:id/students", (req, res) => {
  const id = Number(req.params.id);
  const db = readDB();
  res.json(db.students.filter(s => s.groupId === id).map(safeStudent));
});

app.post("/api/students/:id/attendance", (req, res) => {
  const id = Number(req.params.id);
  const { present } = req.body;
  const db = readDB();
  const student = db.students.find(s => s.id === id);

  if (!student) return res.status(404).json({ error: "O‘quvchi topilmadi." });

  const date = today();
  student.attendance = (student.attendance || []).filter(x => x.date !== date);
  student.attendance.push({ date, present: Boolean(present) });

  writeDB(db);
  res.json(safeStudent(student));
});

app.post("/api/students/:id/homework", (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body;
  if (!["bor", "chala", "yoq"].includes(status)) {
    return res.status(400).json({ error: "Noto‘g‘ri vazifa holati." });
  }

  const db = readDB();
  const student = db.students.find(s => s.id === id);
  if (!student) return res.status(404).json({ error: "O‘quvchi topilmadi." });

  const date = today();
  student.homework = (student.homework || []).filter(x => x.date !== date);
  student.homework.push({ date, status });

  writeDB(db);
  res.json(safeStudent(student));
});

app.post("/api/students/:id/extra", (req, res) => {
  const id = Number(req.params.id);
  const score = Number(req.body.score);

  if (!Number.isFinite(score)) return res.status(400).json({ error: "Ball son bo‘lishi kerak." });

  const db = readDB();
  const student = db.students.find(s => s.id === id);
  if (!student) return res.status(404).json({ error: "O‘quvchi topilmadi." });

  student.extraScore = Number(student.extraScore || 0) + score;
  writeDB(db);
  res.json(safeStudent(student));
});

app.get("/api/students/:id", (req, res) => {
  const id = Number(req.params.id);
  const db = readDB();
  const student = db.students.find(s => s.id === id);
  if (!student) return res.status(404).json({ error: "O‘quvchi topilmadi." });
  res.json(safeStudent(student));
});

app.get("*", (req, res) => {
  res.json({ message: "EduScore API ishlayapti." });
});

app.listen(PORT, () => {
  console.log(`EduScore API: http://localhost:${PORT}`);
});
