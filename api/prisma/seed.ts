import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  await prisma.review.deleteMany();
  await prisma.learningSession.deleteMany();
  await prisma.savedTeacher.deleteMany();
  await prisma.voiceQueryRecommendation.deleteMany();
  await prisma.voiceQuery.deleteMany();
  await prisma.document.deleteMany();
  await prisma.progressEntry.deleteMany();
  await prisma.availabilitySlot.deleteMany();
  await prisma.teacherTag.deleteMany();
  await prisma.teacherSubject.deleteMany();
  await prisma.teacherProfile.deleteMany();
  await prisma.studentProfile.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.subject.deleteMany();

  const domainMap = {
    'Engineering': ['Civil', 'Mechanical', 'Software', 'Electrical'],
    'Business': ['Strategy', 'Finance', 'Operations'],
    'Marketing': ['SEO', 'Content', 'Social Media'],
    'Mentoring': ['Career', 'Leadership'],
    'Medical': ['Anatomy', 'Pharmacology'],
    'Mathematics': ['Calculus', 'Algebra', 'AP', 'Geometry'],
    'Physics': ['Mechanics', 'Thermodynamics', 'Quantum'],
    'English': ['Literature', 'Grammar', 'Conversation'],
    'Music': ['Piano', 'Vocal', 'Guitar'],
    'Computer Science': ['Algorithms', 'Web Dev', 'Data Science']
  };

  const dbSubjects = [];
  const dbTags = [];

  for (const [subjName, tags] of Object.entries(domainMap)) {
    const slug = subjName.toLowerCase().replace(/\s+/g, '-');
    const dbSubj = await prisma.subject.create({
      data: { name: subjName, slug }
    });
    dbSubjects.push(dbSubj);

    for (const tagName of tags) {
      const dbTag = await prisma.tag.create({
        data: { name: tagName }
      });
      dbTags.push({ ...dbTag, subjectId: dbSubj.id });
    }
  }

  const pass = await bcrypt.hash('Demo123!', 10);

  const teacherProfiles = [];
  for (let i = 1; i <= 50; i++) {
    const subj = dbSubjects[i % dbSubjects.length];
    const subjTags = dbTags.filter(t => t.subjectId === subj.id);
    const tag1 = subjTags[i % subjTags.length];
    const tag2 = subjTags[(i + 1) % subjTags.length];
    
    // Dedup tags
    const tagCreates = [];
    if (tag1) tagCreates.push({ tagId: tag1.id });
    if (tag2 && tag2.id !== tag1?.id) tagCreates.push({ tagId: tag2.id });

    const teacherUser = await prisma.user.create({
      data: {
        email: `teacher${i}@demo.local`,
        passwordHash: pass,
        role: UserRole.teacher,
        status: UserStatus.active,
        profile: {
          create: {
            displayName: `Teacher ${i} (${subj.name})`,
            bio: `Experienced professional in ${subj.name} and related domains.`,
          },
        },
        teacherProfile: {
          create: {
            headline: `Expert in ${subj.name}`,
            yearsExperience: (i % 15) + 1,
            hourlyRateCents: 5000 + (i * 100),
            currency: 'USD',
            primarySubjectId: subj.id,
            subjects: {
              create: [{ subjectId: subj.id }],
            },
            tags: {
              create: tagCreates
            }
          },
        },
      },
      include: { teacherProfile: true },
    });

    teacherProfiles.push(teacherUser.teacherProfile);

    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + (i % 7));
    const end = new Date(nextWeek);
    end.setHours(end.getHours() + 2);
    await prisma.availabilitySlot.create({
      data: {
        teacherId: teacherUser.teacherProfile!.id,
        startAt: nextWeek,
        endAt: end,
      }
    });
  }

  const studentUsers = [];
  for (let i = 1; i <= 10; i++) {
    const studentUser = await prisma.user.create({
      data: {
        email: `student${i}@demo.local`,
        passwordHash: pass,
        role: UserRole.student,
        status: UserStatus.active,
        profile: {
          create: {
            displayName: `Student ${i}`,
          },
        },
        studentProfile: {
          create: {
            goals: `Learn more about various subjects`,
          },
        },
      },
    });
    studentUsers.push(studentUser);
  }

  for (let i = 0; i < 50; i++) {
    const teacherProf = teacherProfiles[i]!;
    const numReviews = (i % 3) + 2; 
    for (let j = 0; j < numReviews; j++) {
      const student = studentUsers[(i + j) % studentUsers.length];
      const sess = await prisma.learningSession.create({
        data: {
          teacherId: teacherProf.userId,
          studentId: student.id,
          scheduledAt: new Date(Date.now() - (j * 86400000)),
          status: 'completed',
        }
      });

      await prisma.review.create({
        data: {
          studentId: student.id,
          teacherId: teacherProf.id,
          sessionId: sess.id,
          rating: 3 + (j % 3), // 3, 4, 5
          comment: `Great session ${j + 1}! Highly recommend.`
        }
      });
    }
  }

  console.log('Seed completed: 50 diverse professional teachers, 10 students, and mock reviews generated.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
