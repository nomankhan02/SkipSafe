import { analyzeAll, Course } from "./attendance";

const courses: Course[] = [
    { code: "TEST-1", thCredits: 3, prCredits: 0, thPresent: 20, thHeld: 24, prPresent: 0, prHeld: 0 },
    { code: "TEST-2", thCredits: 2, prCredits: 0, thPresent: 10, thHeld: 16, prPresent: 0, prHeld: 0 },
];

console.table(analyzeAll(courses));