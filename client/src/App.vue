<script setup>
import { computed, onMounted, ref } from "vue";

const user = ref(null);
const loginForm = ref({ username: "", password: "" });
const loginError = ref("");
const page = ref("dashboard");
const dashboard = ref({ teachers: 0, groups: 0, students: 0, totalScore: 0 });
const teachers = ref([]);
const groups = ref([]);
const students = ref([]);
const selectedGroup = ref(null);
const groupStudents = ref([]);
const loading = ref(false);
const message = ref("");

const teacherForm = ref({ name: "", username: "", password: "" });
const groupForm = ref({ name: "", teacherId: "" });
const studentForm = ref({ name: "", username: "", password: "", groupId: "" });

const isAdmin = computed(() => user.value?.role === "admin");
const isTeacher = computed(() => user.value?.role === "teacher");
const isStudent = computed(() => user.value?.role === "student");

async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Xatolik yuz berdi.");
  return data;
}

async function login() {
  loginError.value = "";
  try {
    const data = await api("/api/login", {
      method: "POST",
      body: JSON.stringify(loginForm.value)
    });
    user.value = data.user;
    loginForm.value = { username: "", password: "" };
    if (user.value.role === "student") {
      page.value = "my-score";
      await loadStudent();
    } else {
      page.value = "dashboard";
      await loadAll();
    }
  } catch (e) {
    loginError.value = e.message;
  }
}

function logout() {
  user.value = null;
  selectedGroup.value = null;
  groupStudents.value = [];
  page.value = "dashboard";
}

async function loadDashboard() {
  dashboard.value = await api("/api/dashboard");
}

async function loadTeachers() {
  teachers.value = await api("/api/teachers");
}

async function loadGroups() {
  const all = await api("/api/groups");
  if (isTeacher.value) {
    groups.value = all.filter(g => g.teacherId === user.value.id);
  } else {
    groups.value = all;
  }
}

async function loadStudents() {
  const all = await api("/api/students");
  if (isTeacher.value) {
    const ids = new Set(groups.value.map(g => g.id));
    students.value = all.filter(s => ids.has(s.groupId));
  } else {
    students.value = all;
  }
}

async function loadAll() {
  loading.value = true;
  try {
    await loadDashboard();
    await loadTeachers();
    await loadGroups();
    await loadStudents();
    if (selectedGroup.value) await openGroup(selectedGroup.value.id, false);
  } finally {
    loading.value = false;
  }
}

async function openGroup(group, refresh = true) {
  selectedGroup.value = group;
  page.value = "groups";
  if (refresh) message.value = "Guruh ma’lumotlari yangilanmoqda...";
  groupStudents.value = await api(`/api/groups/${group.id}/students`);
  if (refresh) {
    await loadDashboard();
    message.value = "Guruh yangilandi.";
    setTimeout(() => message.value = "", 1800);
  }
}

function teacherName(id) {
  return teachers.value.find(t => t.id === id)?.name || "Biriktirilmagan";
}

async function addTeacher() {
  try {
    await api("/api/teachers", { method: "POST", body: JSON.stringify(teacherForm.value) });
    teacherForm.value = { name: "", username: "", password: "" };
    await loadAll();
    message.value = "O‘qituvchi qo‘shildi.";
  } catch (e) { alert(e.message); }
}

async function deleteTeacher(id) {
  if (!confirm("O‘qituvchini o‘chirasizmi?")) return;
  await api(`/api/teachers/${id}`, { method: "DELETE" });
  await loadAll();
}

async function addGroup() {
  try {
    await api("/api/groups", { method: "POST", body: JSON.stringify(groupForm.value) });
    groupForm.value = { name: "", teacherId: "" };
    await loadAll();
    message.value = "Guruh qo‘shildi.";
  } catch (e) { alert(e.message); }
}

async function addStudent() {
  try {
    await api("/api/students", { method: "POST", body: JSON.stringify(studentForm.value) });
    studentForm.value = { name: "", username: "", password: "", groupId: "" };
    await loadAll();
    if (selectedGroup.value) await openGroup(selectedGroup.value, false);
    message.value = "O‘quvchi qo‘shildi.";
  } catch (e) { alert(e.message); }
}

async function deleteStudent(id) {
  if (!confirm("O‘quvchini o‘chirasizmi?")) return;
  await api(`/api/students/${id}`, { method: "DELETE" });
  await loadAll();
  if (selectedGroup.value) await openGroup(selectedGroup.value, false);
}

async function attendance(student, present) {
  await api(`/api/students/${student.id}/attendance`, {
    method: "POST",
    body: JSON.stringify({ present })
  });
  await refreshGroup();
}

async function homework(student, status) {
  await api(`/api/students/${student.id}/homework`, {
    method: "POST",
    body: JSON.stringify({ status })
  });
  await refreshGroup();
}

async function extra(student) {
  const value = prompt("Qo‘shimcha ballni kiriting:");
  if (value === null) return;
  const score = Number(value);
  if (!Number.isFinite(score)) return alert("Faqat son kiriting.");
  await api(`/api/students/${student.id}/extra`, {
    method: "POST",
    body: JSON.stringify({ score })
  });
  await refreshGroup();
}

async function refreshGroup() {
  if (!selectedGroup.value) return;
  await openGroup(selectedGroup.value, false);
  await loadDashboard();
}

const myStudent = ref(null);

async function loadStudent() {
  myStudent.value = await api(`/api/students/${user.value.id}`);
}

function scoreLabel(student) {
  return `${student.totalScore} ball`;
}

onMounted(() => {});
</script>

<template>
  <div v-if="!user" class="login-page">
    <div class="login-card">
      <div class="brand">EduScore</div>
      <p class="muted">O‘quvchilar ball tizimi</p>

      <form @submit.prevent="login">
        <label>Login</label>
        <input v-model="loginForm.username" placeholder="Login" />
        <label>Parol</label>
        <input v-model="loginForm.password" type="password" placeholder="Parol" />
        <button class="primary full">Kirish</button>
      </form>

      <p v-if="loginError" class="error">{{ loginError }}</p>
      <div class="demo">
        <b>Demo:</b> admin / 1234<br>
        O‘qituvchi: anvar / 1234<br>
        O‘quvchi: usmon / 1234
      </div>
    </div>
  </div>

  <div v-else class="app">
    <aside class="sidebar">
      <div class="brand white">EduScore</div>

      <div class="nav">
        <button v-if="!isStudent" :class="{active: page==='dashboard'}" @click="page='dashboard';loadAll()">Dashboard</button>
        <button v-if="isAdmin" :class="{active: page==='teachers'}" @click="page='teachers';loadTeachers()">O‘qituvchilar</button>
        <button v-if="!isStudent" :class="{active: page==='groups'}" @click="page='groups';loadGroups()">Guruhlar</button>
        <button v-if="!isStudent" :class="{active: page==='students'}" @click="page='students';loadStudents()">O‘quvchilar</button>
        <button v-if="isStudent" :class="{active: page==='my-score'}" @click="page='my-score';loadStudent()">Mening ballarim</button>
      </div>

      <div class="side-bottom">
        <div class="side-user">{{ user.name }}</div>
        <button class="logout" @click="logout">Chiqish</button>
      </div>
    </aside>

    <main class="main">
      <div class="topbar">
        <div>
          <h1 v-if="page==='dashboard'">Dashboard</h1>
          <h1 v-if="page==='teachers'">O‘qituvchilar</h1>
          <h1 v-if="page==='groups'">Guruhlar</h1>
          <h1 v-if="page==='students'">O‘quvchilar</h1>
          <h1 v-if="page==='my-score'">Mening ballarim</h1>
        </div>
        <span v-if="loading" class="muted">Yangilanmoqda...</span>
      </div>

      <div v-if="message" class="toast">{{ message }}</div>

      <!-- Dashboard -->
      <section v-if="page==='dashboard'">
        <div class="stats">
          <div class="stat"><span>O‘qituvchilar</span><b>{{ dashboard.teachers }}</b></div>
          <div class="stat"><span>Guruhlar</span><b>{{ dashboard.groups }}</b></div>
          <div class="stat"><span>O‘quvchilar</span><b>{{ dashboard.students }}</b></div>
          <div class="stat"><span>Jami ball</span><b>{{ dashboard.totalScore }}</b></div>
        </div>

        <div class="panel">
          <div class="panel-title">Guruhlar</div>
          <div class="grid">
            <button v-for="g in groups" :key="g.id" class="group-card" @click="openGroup(g)">
              <strong>{{ g.name }}</strong>
              <span>{{ teacherName(g.teacherId) }}</span>
              <small>Guruhni ochish →</small>
            </button>
          </div>
        </div>
      </section>

      <!-- Teachers -->
      <section v-if="page==='teachers' && isAdmin">
        <div class="two-col">
          <div class="panel">
            <div class="panel-title">Yangi o‘qituvchi</div>
            <input v-model="teacherForm.name" placeholder="Ism Familya" />
            <input v-model="teacherForm.username" placeholder="Login" />
            <input v-model="teacherForm.password" placeholder="Parol" />
            <button class="primary" @click="addTeacher">O‘qituvchi qo‘shish</button>
          </div>

          <div class="panel">
            <div class="panel-title">O‘qituvchilar ro‘yxati</div>
            <div v-for="t in teachers" :key="t.id" class="list-row">
              <div><b>{{ t.name }}</b><span>{{ t.username }}</span></div>
              <button class="danger" @click="deleteTeacher(t.id)">O‘chirish</button>
            </div>
          </div>
        </div>
      </section>

      <!-- Groups -->
      <section v-if="page==='groups' && !isStudent">
        <div class="two-col">
          <div v-if="isAdmin" class="panel">
            <div class="panel-title">Yangi guruh</div>
            <input v-model="groupForm.name" placeholder="Guruh nomi" />
            <select v-model="groupForm.teacherId">
              <option value="">O‘qituvchi tanlang</option>
              <option v-for="t in teachers" :key="t.id" :value="t.id">{{ t.name }}</option>
            </select>
            <button class="primary" @click="addGroup">Guruh qo‘shish</button>
          </div>

          <div class="panel">
            <div class="panel-title">Guruhlar</div>
            <div class="grid">
              <button v-for="g in groups" :key="g.id" class="group-card" @click="openGroup(g)">
                <strong>{{ g.name }}</strong>
                <span>{{ teacherName(g.teacherId) }}</span>
                <small>O‘quvchilar va ballar →</small>
              </button>
            </div>
          </div>
        </div>

        <div v-if="selectedGroup" class="panel group-panel">
          <div class="panel-head">
            <div>
              <div class="panel-title">{{ selectedGroup.name }}</div>
              <div class="muted">{{ groupStudents.length }} ta o‘quvchi</div>
            </div>
            <button class="secondary" @click="refreshGroup">↻ Yangilash</button>
          </div>

          <div v-if="!groupStudents.length" class="empty">Bu guruhda o‘quvchi yo‘q.</div>

          <div v-for="s in groupStudents" :key="s.id" class="student-card">
            <div class="student-head">
              <div>
                <strong>{{ s.name }}</strong>
                <div class="muted">{{ s.username }}</div>
              </div>
              <div class="total">{{ scoreLabel(s) }}</div>
            </div>

            <div class="section-label">Davomat</div>
            <div class="actions">
              <button class="success" @click="attendance(s,true)">✓ Bor +3</button>
              <button class="danger" @click="attendance(s,false)">✕ Yo‘q</button>
            </div>

            <div class="section-label">Uy vazifasi</div>
            <div class="actions">
              <button class="success" @click="homework(s,'bor')">✓ Bor +5</button>
              <button class="warning" @click="homework(s,'chala')">Chala +3</button>
              <button class="danger" @click="homework(s,'yoq')">✕ Yo‘q +1</button>
            </div>

            <div class="actions extra">
              <button class="secondary" @click="extra(s)">+ Qo‘shimcha ball</button>
              <button v-if="isAdmin" class="danger" @click="deleteStudent(s.id)">O‘quvchini o‘chirish</button>
            </div>

            <div class="score-details">
              <span>Davomat: <b>{{ s.attendanceScore }}</b></span>
              <span>Vazifa: <b>{{ s.homeworkScore }}</b></span>
              <span>Qo‘shimcha: <b>{{ s.extraScore || 0 }}</b></span>
              <span>Jami: <b>{{ s.totalScore }}</b></span>
            </div>
          </div>

          <div class="add-student">
            <div class="panel-title">O‘quvchi qo‘shish</div>
            <div class="form-grid">
              <input v-model="studentForm.name" placeholder="Ism Familya" />
              <input v-model="studentForm.username" placeholder="Login" />
              <input v-model="studentForm.password" placeholder="Parol" />
              <select v-model="studentForm.groupId">
                <option value="">Guruh tanlang</option>
                <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.name }}</option>
              </select>
            </div>
            <button class="primary" @click="addStudent">O‘quvchi qo‘shish</button>
          </div>
        </div>
      </section>

      <!-- Students -->
      <section v-if="page==='students' && !isStudent">
        <div class="panel">
          <div class="panel-title">Barcha o‘quvchilar</div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Ism Familya</th><th>Guruh</th><th>Jami ball</th></tr></thead>
              <tbody>
                <tr v-for="s in students" :key="s.id">
                  <td><b>{{ s.name }}</b></td>
                  <td>{{ groups.find(g=>g.id===s.groupId)?.name || '—' }}</td>
                  <td><b>{{ s.totalScore }}</b></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- Student panel -->
      <section v-if="page==='my-score' && isStudent">
        <div v-if="myStudent" class="student-profile">
          <div class="big-score">{{ myStudent.totalScore }}</div>
          <h2>{{ myStudent.name }}</h2>
          <p class="muted">Umumiy yig‘ilgan ball</p>

          <div class="score-boxes">
            <div><span>Davomat</span><b>{{ myStudent.attendanceScore }}</b></div>
            <div><span>Uy vazifasi</span><b>{{ myStudent.homeworkScore }}</b></div>
            <div><span>Qo‘shimcha</span><b>{{ myStudent.extraScore || 0 }}</b></div>
          </div>

          <button class="secondary" @click="loadStudent">↻ Ballarni yangilash</button>
        </div>
      </section>
    </main>
  </div>
</template>
