# Firebase Data Connect Seed Examples

Use these mutation templates from the Firebase Data Connect console, VS Code extension, or generated SDK after deploying the schema. Replace the sample values before running them.

## 1. Create users

```graphql
mutation CreateTeacher {
  CreateUser(
    name: "Teacher Name"
    email: "teacher@example.edu"
    role: "teacher"
    phoneNumber: "+8801000000001"
    profilePictureUrl: ""
  )
}

mutation CreateStudent {
  CreateUser(
    name: "Student Name"
    email: "student@example.edu"
    role: "student"
    phoneNumber: "+8801000000002"
    profilePictureUrl: ""
  )
}
```

## 2. Create subjects

```graphql
mutation SeedSubjects {
  math: CreateSubject(name: "Mathematics")
  english: CreateSubject(name: "English")
  science: CreateSubject(name: "Science")
}
```

## 3. Create classroom

Run this after creating a teacher, then use the teacher `id` as `headTeacherId`.

```graphql
mutation SeedClassroom($headTeacherId: UUID!) {
  CreateClassroom(
    name: "Class One"
    section: "Group A"
    headTeacherId: $headTeacherId
  )
}
```

Variables:

```json
{
  "headTeacherId": "00000000-0000-0000-0000-000000000000"
}
```

## 4. Create routine

Use IDs returned from `ListClassrooms`, `ListSubjects`, and `ListUsers`.

```graphql
mutation SeedRoutine($classroomId: UUID!, $subjectId: UUID!, $teacherId: UUID!) {
  CreateRoutine(
    dayOfWeek: "Sunday"
    startTime: "09:00"
    endTime: "09:45"
    classroomId: $classroomId
    subjectId: $subjectId
    teacherId: $teacherId
  )
}
```

## 5. Create exam result

Use the student user `id` and subject `id`.

```graphql
mutation SeedExamResult($studentId: UUID!, $subjectId: UUID!) {
  CreateExamResult(
    marksObtained: 85
    totalMarks: 100
    examDate: "2026-07-06"
    studentId: $studentId
    subjectId: $subjectId
  )
}
```
