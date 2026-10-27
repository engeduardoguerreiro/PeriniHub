import { XMLParser } from "fast-xml-parser";

import { htmlToText, parseFeedDate } from "./text";

export type FeedItem = {
  title: string;
  link: string;
  publishedAt: string | null;
  summary: string;
};

export class FeedParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FeedParseError";
  }
}

// XML vem de fora. O parser não resolve entidades externas (sem XXE) nem
// expande entidades declaradas no DOCTYPE (sem "billion laughs"); os limites
// abaixo contam as entidades padrão (&amp; etc.), comuns em HTML escapado, e
// o tamanho total já vem limitado pelo teto de bytes do safeFetch.
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  processEntities: { enabled: true, maxEntityCount: 50, maxTotalExpansions: 2_000_000, maxExpandedLength: 20_000_000 },
  isArray: (name) => ["item", "entry", "link"].includes(name),
});

type Node = Record<string, unknown>;

function text(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return text(value[0]);
  if (typeof value === "object") return text((value as Node)["#text"]);
  return "";
}

function atomLink(links: unknown): string {
  if (!Array.isArray(links)) return text(links);
  const entries = links as Node[];
  const alternate =
    entries.find((link) => typeof link === "object" && (!link["@_rel"] || link["@_rel"] === "alternate")) ?? entries[0];
  if (typeof alternate === "string") return alternate;
  return text(alternate?.["@_href"]) || text(alternate);
}

function cleanSummary(raw: string) {
  return htmlToText(`<body>${raw}</body>`, 1500);
}

/** Itens de um feed RSS 2.0, RSS 1.0 (RDF) ou Atom. Itens sem título ou link são descartados. */
export function parseFeed(xml: string, now = Date.now()): FeedItem[] {
  let doc: Node;
  try {
    doc = parser.parse(xml) as Node;
  } catch (error) {
    throw new FeedParseError(error instanceof Error ? error.message : "XML inválido");
  }

  const rss = doc.rss as Node | undefined;
  const rdf = doc["rdf:RDF"] as Node | undefined;
  const atom = doc.feed as Node | undefined;

  let raw: { title: string; link: string; date: unknown; summary: string }[];
  if (rss?.channel) {
    const channel = (Array.isArray(rss.channel) ? rss.channel[0] : rss.channel) as Node;
    raw = ((channel.item as Node[] | undefined) ?? []).map((item) => ({
      title: text(item.title),
      link: atomLink(item.link) || text(item.guid),
      date: text(item.pubDate) || text(item["dc:date"]),
      summary: text(item.description) || text(item["content:encoded"]),
    }));
  } else if (rdf) {
    raw = ((rdf.item as Node[] | undefined) ?? []).map((item) => ({
      title: text(item.title),
      link: atomLink(item.link),
      date: text(item["dc:date"]),
      summary: text(item.description),
    }));
  } else if (atom) {
    raw = ((atom.entry as Node[] | undefined) ?? []).map((entry) => ({
      title: text(entry.title),
      link: atomLink(entry.link),
      date: text(entry.published) || text(entry.updated),
      summary: text(entry.summary) || text(entry.content),
    }));
  } else {
    throw new FeedParseError("Formato de feed não reconhecido");
  }

  return raw.flatMap((item) => {
    const title = htmlToText(`<body>${item.title}</body>`, 500);
    const link = item.link.trim();
    if (!title || !/^https?:\/\//i.test(link)) return [];
    return [{ title, link, publishedAt: parseFeedDate(item.date, now), summary: cleanSummary(item.summary) }];
  });
}
