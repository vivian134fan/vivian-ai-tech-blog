import matter from 'gray-matter';
import { marked } from 'marked';

marked.setOptions({ gfm: true, breaks: false });

const modules = import.meta.glob('/src/posts/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export interface Post {
  slug: string;
  title: string;
  date: string;
  dateLabel: string;
  description: string;
  tags: string[];
  source?: string;
  cover?: string;
  html: string;
  minutes: number;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function readingMinutes(md: string): number {
  const chars = md.replace(/\s/g, '').length;
  return Math.max(1, Math.round(chars / 350));
}

function toPost(filePath: string, raw: string): Post {
  const slug = filePath.split('/').pop()!.replace(/\.md$/, '');
  const { data, content } = matter(raw);
  const date = data.date
    ? (data.date instanceof Date ? data.date.toISOString() : String(data.date))
    : '1970-01-01';

  return {
    slug,
    title: data.title ?? slug,
    date,
    dateLabel: formatDate(date),
    description: data.description ?? '',
    tags: Array.isArray(data.tags) ? data.tags : data.tags ? [String(data.tags)] : [],
    source: data.source,
    cover: data.cover,
    html: marked.parse(content, { async: false }) as string,
    minutes: readingMinutes(content),
  };
}

export function getPosts(): Post[] {
  return Object.entries(modules)
    .map(([p, raw]) => toPost(p, raw))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getPost(slug: string): Post | undefined {
  return getPosts().find((p) => p.slug === slug);
}
