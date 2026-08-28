export const profile = {
  name: "Naga Teja Susmitha Peravali",
  role: "Software Engineer",
  tagline: "Building intelligent software.",
  heroHeadline: "Building intelligent software that bridges AI and full-stack engineering.",
  heroSub:
    "I design and ship complete systems — not isolated features — across AI, backend, and frontend, with a habit of learning by building.",
  email: "susmitha.9.9.9p@gmail.com",
  github: "https://github.com/Susmitha-Peravali",
  linkedin: "https://www.linkedin.com/in/susmitha-peravali-a57438291/",
  resumeUrl: "/resume.pdf",
  location: "SRM University AP, Andhra Pradesh",
  aboutParagraphs: [
    "I'm Naga Teja Susmitha Peravali, a software engineer studying Computer Science Engineering at SRM University AP, with a minor in Robotics.",
    "I enjoy building complete software products rather than isolated features — the kind of work that touches a database schema, an API contract, a model's inference loop, and the pixel that finally reaches a user.",
    "My interests sit at the intersection of AI, backend systems, and frontend engineering: real-time applications, automation, and interfaces that make complex systems feel simple.",
    "Most of what I know, I learned by building — shipping small, imperfect systems and rebuilding them until they held up.",
  ],
  interests: [
    "Artificial Intelligence",
    "Backend Systems",
    "Frontend Engineering",
    "Real-time Systems",
    "Automation",
    "Problem Solving",
  ],
  education: {
    school: "SRM University AP",
    degree: "B.Tech, Computer Science Engineering",
    minor: "Minor in Robotics",
    cgpa: "9.43",
    graduation: "2027",
  },
} as const;

export type SkillCategory = {
  id: string;
  label: string;
  items: string[];
};

export const skillCategories: SkillCategory[] = [
  {
    id: "languages",
    label: "Languages",
    items: ["Python", "JavaScript", "Java", "C++", "C", "PHP"],
  },
  {
    id: "frontend",
    label: "Frontend",
    items: ["React", "Next.js", "Tailwind CSS", "Bootstrap", "HTML", "CSS"],
  },
  {
    id: "backend",
    label: "Backend",
    items: ["Node.js", "Express.js", "Flask", "PHP", "REST APIs", "JWT", "RBAC"],
  },
  {
    id: "databases",
    label: "Databases",
    items: ["MongoDB", "MySQL"],
  },
  {
    id: "ai-ml",
    label: "AI & Machine Learning",
    items: ["Google Gemini API", "Prolog", "PySwip", "Machine Learning", "Deep Learning"],
  },
  {
    id: "tools-devops",
    label: "Tools & DevOps",
    items: ["Git", "GitHub", "Docker", "Postman", "VS Code", "Figma", "Chart.js"],
  },
];

export const coreCS: string[] = [
  "Data Structures",
  "Algorithms",
  "DBMS",
  "Operating Systems",
  "Computer Networks",
  "Software Engineering",
];

export type ExperienceItem = {
  id: string;
  company: string;
  role: string;
  period: string;
  summary: string;
  highlights: string[];
  stack: string[];
};

export const experience: ExperienceItem[] = [
  {
    id: "hcltech",
    company: "HCLTech",
    role: "Software Engineering Intern",
    period: "Internship",
    summary:
      "Built and maintained an advanced e-commerce analytics platform used to surface business-facing dashboards.",
    highlights: [
      "Built interactive business dashboards with Chart.js",
      "Developed and consumed REST APIs for analytics data",
      "Collaborated with backend teams on data validation and integrity",
    ],
    stack: ["Chart.js", "REST APIs", "Dashboards", "SQL"],
  },
  {
    id: "trinwo",
    company: "Trinwo Solutions",
    role: "Software Engineering Intern",
    period: "Internship",
    summary:
      "Built backend services and authentication systems, and contributed to UI/UX design work in Figma.",
    highlights: [
      "Implemented authentication and role-based access control (RBAC)",
      "Built REST APIs backed by MySQL",
      "Designed interfaces and flows in Figma",
    ],
    stack: ["PHP", "MySQL", "REST APIs", "RBAC", "Figma"],
  },
];

export type Achievement = {
  id: string;
  title: string;
  detail: string;
};

export const achievements: Achievement[] = [
  { id: "schrodinger", title: "Top 12 Finalist", detail: "Mission Schrödinger Cat Hackathon" },
  { id: "janatics", title: "Stage 2 Qualifier", detail: "Janatics Automation Skill Challenge" },
  { id: "adobe", title: "Round 1", detail: "Adobe India Hackathon" },
  { id: "oracle", title: "Oracle Certified", detail: "Java Programmer" },
  { id: "leetcode", title: "170+ Problems", detail: "LeetCode" },
];
