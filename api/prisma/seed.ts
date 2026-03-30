import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const subjects = [
    { name: 'Mathematics', slug: 'mathematics' },
    { name: 'Physics', slug: 'physics' },
    { name: 'English', slug: 'english' },
    { name: 'Music', slug: 'music' },
    { name: 'Computer Science', slug: 'computer-science' },
  ];

  for (const s of subjects) {
    await prisma.subject.upsert({
      where: { slug: s.slug },
      update: {},
      create: s,
    });
  }

  const tags = ['Calculus', 'Algebra', 'AP', 'Beginner', 'Exam Prep', 'Conversation'];
  for (const name of tags) {
    await prisma.tag.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  const math = await prisma.subject.findUniqueOrThrow({ where: { slug: 'mathematics' } });
  const physics = await prisma.subject.findUniqueOrThrow({ where: { slug: 'physics' } });

  const pass = await bcrypt.hash('TeacherDemo123!', 10);
  const teacherUser = await prisma.user.upsert({
    where: { email: 'teacher@demo.local' },
    update: {},
    create: {
      email: 'teacher@demo.local',
      passwordHash: pass,
      role: UserRole.teacher,
      status: UserStatus.active,
      profile: {
        create: {
          displayName: 'Alex Morgan',
          bio: 'Experienced math and physics tutor.',
        },
      },
      teacherProfile: {
        create: {
          headline: 'Math & Physics — 10+ years',
          yearsExperience: 10,
          hourlyRateCents: 7500,
          currency: 'USD',
          primarySubjectId: math.id,
          subjects: {
            create: [{ subjectId: math.id }, { subjectId: physics.id }],
          },
        },
      },
    },
    include: { teacherProfile: true },
  });

  if (teacherUser.teacherProfile) {
    const calc = await prisma.tag.findUnique({ where: { name: 'Calculus' } });
    if (calc) {
      await prisma.teacherTag.upsert({
        where: {
          teacherId_tagId: { teacherId: teacherUser.teacherProfile.id, tagId: calc.id },
        },
        update: {},
        create: { teacherId: teacherUser.teacherProfile.id, tagId: calc.id },
      });
    }
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const end = new Date(nextWeek);
    end.setHours(end.getHours() + 2);
    await prisma.availabilitySlot.createMany({
      data: [
        {
          teacherId: teacherUser.teacherProfile.id,
          startAt: nextWeek,
          endAt: end,
        },
      ],
      skipDuplicates: true,
    });
  }

  const spass = await bcrypt.hash('StudentDemo123!', 10);
  await prisma.user.upsert({
    where: { email: 'student@demo.local' },
    update: {},
    create: {
      email: 'student@demo.local',
      passwordHash: spass,
      role: UserRole.student,
      status: UserStatus.active,
      profile: {
        create: {
          displayName: 'Jamie Lee',
        },
      },
      studentProfile: {
        create: {
          goals: 'Improve calculus grades',
        },
      },
    },
  });

  console.log('Seed completed: demo teacher/student, subjects, tags.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
