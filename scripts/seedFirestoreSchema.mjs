import { initializeApp } from 'firebase/app';
import {
    doc,
    getFirestore,
    serverTimestamp,
    setDoc,
    writeBatch,
} from 'firebase/firestore';

const firebaseConfig = {
    apiKey: 'AIzaSyB3qCzJeuCl9NDKNssZ-B00CJ7MYAyXig0',
    authDomain: 'teachers-620a5.firebaseapp.com',
    projectId: 'teachers-620a5',
    storageBucket: 'teachers-620a5.firebasestorage.app',
    messagingSenderId: '561573289303',
    appId: '1:561573289303:web:bfad9a78da7e3a0bf4f212',
    measurementId: 'G-0TFBC9KLSM',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const cleanId = (value, fallback = 'item') => {
    const id = String(value ?? '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return id || fallback;
};

const buildResultId = ({ studentId, examId, subject }) => `${cleanId(studentId, 'student')}-${cleanId(examId, 'current')}-${cleanId(subject, 'subject')}`;
const buildGroupSubjectId = (classId, groupName) => `${cleanId(classId, 'class')}-${cleanId(groupName, 'group')}`;

const users = [
    { userId: 'admin', name: 'Admin Administrator', password: 'admin', role: 'admin', status: 'active' },
];

const schoolProfile = {
    schoolName: 'Greenfield International School',
    logo: '',
    adminName: 'System Admin',
    adminTitle: 'Administrator',
    adminEmail: 'admin@school.edu',
    adminPhone: '+880 1000-000000',
    schemaVersion: 1,
};

const subjects = ['Mathematics', 'Physics', 'Chemistry', 'English', 'Science', 'History', 'Geography', 'Computer Science'];

const classes = [
    {
        classId: 'class-one',
        className: 'Class One',
        classNum: 1,
        groups: ['Group A', 'Group B'],
        students: [],
    },
    {
        classId: 'class-two',
        className: 'Class Two',
        classNum: 2,
        groups: ['Group A', 'Group B'],
        students: [],
    },
];

const teachers = [];

const exams = [
    { examId: 'current', name: 'Current Term', term: 'Current', session: '2026', status: 'active' },
    { examId: 'mid-term-2026', name: 'Mid Term 2026', term: 'Mid Term', session: '2026', status: 'draft' },
    { examId: 'final-2026', name: 'Final 2026', term: 'Final', session: '2026', status: 'draft' },
];

const grades = [
    { gradeId: 'a-plus', grade: 'A+', minMarks: 80, maxMarks: 100, gradePoint: 5, status: 'Pass' },
    { gradeId: 'a', grade: 'A', minMarks: 70, maxMarks: 79, gradePoint: 4, status: 'Pass' },
    { gradeId: 'a-minus', grade: 'A-', minMarks: 60, maxMarks: 69, gradePoint: 3.5, status: 'Pass' },
    { gradeId: 'b', grade: 'B', minMarks: 50, maxMarks: 59, gradePoint: 3, status: 'Pass' },
    { gradeId: 'c', grade: 'C', minMarks: 40, maxMarks: 49, gradePoint: 2, status: 'Pass' },
    { gradeId: 'd', grade: 'D', minMarks: 33, maxMarks: 39, gradePoint: 1, status: 'Pass' },
    { gradeId: 'f', grade: 'F', minMarks: 0, maxMarks: 32, gradePoint: 0, status: 'Fail' },
];

const groupSubjects = [
    { classId: 'class-one', className: 'Class One', classIdx: 0, groupName: 'Group A', subjects: ['Mathematics', 'English', 'Science'] },
    { classId: 'class-one', className: 'Class One', classIdx: 0, groupName: 'Group B', subjects: ['Mathematics', 'English', 'Computer Science'] },
    { classId: 'class-two', className: 'Class Two', classIdx: 1, groupName: 'Group A', subjects: ['Mathematics', 'English', 'Science'] },
];

const seedSchema = async () => {
    const batch = writeBatch(db);
    const nowFields = () => ({ createdAt: serverTimestamp(), updatedAt: serverTimestamp(), schemaVersion: 1 });

    batch.set(doc(db, 'schoolData', 'schoolProfile'), { ...schoolProfile, updatedAt: serverTimestamp() }, { merge: true });
    batch.set(doc(db, 'schoolData', 'teacherPanel'), {
        classes: classes.map(({ students, ...classInfo }) => ({
            ...classInfo,
            students: students.map((student) => ({
                ...student,
                id: student.studentId,
                class: classInfo.className,
                classId: classInfo.classId,
            })),
            groupSubjects: groupSubjects
                .filter((item) => item.classId === classInfo.classId)
                .reduce((acc, item) => ({ ...acc, [item.groupName]: item.subjects }), {}),
        })),
        teachers,
        updatedAt: serverTimestamp(),
        schemaVersion: 1,
    }, { merge: true });

    users.forEach((user) => batch.set(doc(db, 'users', user.userId), { ...user, ...nowFields() }, { merge: true }));
    teachers.forEach((teacher) => batch.set(doc(db, 'teachers', teacher.teacherId), { ...teacher, ...nowFields() }, { merge: true }));
    subjects.forEach((subject) => batch.set(doc(db, 'subjects', cleanId(subject, 'subject')), {
        subjectId: cleanId(subject, 'subject'),
        name: subject,
        status: 'active',
        ...nowFields(),
    }, { merge: true }));
    exams.forEach((exam) => batch.set(doc(db, 'exams', exam.examId), { ...exam, ...nowFields() }, { merge: true }));
    grades.forEach((grade) => batch.set(doc(db, 'grades', grade.gradeId), { ...grade, ...nowFields() }, { merge: true }));

    classes.forEach((classInfo) => {
        batch.set(doc(db, 'classes', classInfo.classId), {
            classId: classInfo.classId,
            className: classInfo.className,
            classNum: classInfo.classNum,
            groups: classInfo.groups,
            studentCount: classInfo.students.length,
            status: 'active',
            ...nowFields(),
        }, { merge: true });

        classInfo.students.forEach((student) => {
            batch.set(doc(db, 'students', student.studentId), {
                ...student,
                class: classInfo.className,
                classId: classInfo.classId,
                profilePic: '',
                status: 'active',
                ...nowFields(),
            }, { merge: true });
        });
    });

    groupSubjects.forEach((item) => {
        batch.set(doc(db, 'groupSubjects', buildGroupSubjectId(item.classId, item.groupName)), {
            ...item,
            subjectIds: item.subjects.map((subject) => cleanId(subject, 'subject')),
            status: 'active',
            ...nowFields(),
        }, { merge: true });
    });

    await batch.commit();
};

seedSchema()
    .then(() => {
        console.log('Firestore schema seed completed for project teachers-620a5.');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Firestore schema seed failed:', error);
        process.exit(1);
    });
