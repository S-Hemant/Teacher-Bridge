import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type NlpResult = {
  subjectSlug?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  keywords: string[];
};

@Injectable()
export class MatchingService {
  constructor(private readonly prisma: PrismaService) {}

  /** Rule-based NLP when no LLM (keywords + subject guess from transcript). */
  parseTranscriptHeuristic(transcript: string): NlpResult {
    const t = transcript.toLowerCase();
    const keywords = transcript
      .split(/\W+/)
      .filter((w) => w.length > 3)
      .slice(0, 12);

    let subjectSlug: string | undefined;
    if (/\b(calculus|algebra|geometry|math|equation)\b/.test(t)) {
      subjectSlug = 'mathematics';
    } else if (/\b(physics|force|newton|velocity)\b/.test(t)) {
      subjectSlug = 'physics';
    } else if (/\b(english|grammar|essay|writing)\b/.test(t)) {
      subjectSlug = 'english';
    } else if (/\b(music|piano|guitar|theory)\b/.test(t)) {
      subjectSlug = 'music';
    } else if (/\b(code|programming|python|javascript)\b/.test(t)) {
      subjectSlug = 'computer-science';
    }

    let difficulty: NlpResult['difficulty'];
    if (/\b(ap|advanced|hard)\b/.test(t)) difficulty = 'advanced';
    else if (/\b(beginner|basic|intro)\b/.test(t)) difficulty = 'beginner';
    else difficulty = 'intermediate';

    return { subjectSlug, difficulty, keywords };
  }

  async scoreTeachers(nlp: NlpResult, limit = 10) {
    const subject = nlp.subjectSlug
      ? await this.prisma.subject.findUnique({
          where: { slug: nlp.subjectSlug },
        })
      : null;

    const teachers = await this.prisma.teacherProfile.findMany({
      where: subject
        ? {
            OR: [
              { primarySubjectId: subject.id },
              { subjects: { some: { subjectId: subject.id } } },
            ],
          }
        : {},
      include: {
        user: { include: { profile: true } },
        primarySubject: true,
        subjects: { include: { subject: true } },
        tags: { include: { tag: true } },
        reviews: true,
      },
      take: 80,
    });

    const scored = teachers.map((tp) => {
      const reviewAvg =
        tp.reviews.length > 0
          ? tp.reviews.reduce((a, r) => a + r.rating, 0) / tp.reviews.length
          : 3;

      let score = reviewAvg * 2;
      const tagNames = new Set(tp.tags.map((x) => x.tag.name.toLowerCase()));
      for (const kw of nlp.keywords) {
        if (tagNames.has(kw.toLowerCase())) score += 1.5;
      }
      if (subject && tp.primarySubjectId === subject.id) score += 2;
      if (subject && tp.subjects.some((s) => s.subjectId === subject.id)) {
        score += 1;
      }
      score += Math.min(tp.yearsExperience, 15) * 0.05;

      const reasons: string[] = [];
      if (subject) reasons.push(`Matches ${subject.name}`);
      if (reviewAvg >= 4) reasons.push('Strong ratings');
      if (tp.yearsExperience >= 5) reasons.push('Experienced');

      return {
        teacherProfileId: tp.id,
        teacherUserId: tp.userId,
        score,
        reason: { summary: reasons.join(' · ') || 'General fit', difficulty: nlp.difficulty },
      };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map((s, i) => ({ ...s, rank: i + 1 }));
  }
}
