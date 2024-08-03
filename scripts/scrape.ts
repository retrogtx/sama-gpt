import axios from 'axios';
import cheerio from 'cheerio';
import { encode } from "gpt-3-encoder";
import fs from 'fs';

interface SamEssay {
  title: string;
  url: string;
  content: string;
  date: string | null;
}

interface EssayChunk {
  title: string;
  url: string;
  date: string | null;
  chunk: string;
  tokenCount: number;
}

async function getTitlesFromPage(pageUrl: string): Promise<{ title: string; url: string }[]> {
  const response = await axios.get(pageUrl);
  const $ = cheerio.load(response.data);
  
  return $('.post-title h2 a').map((_, element) => ({
    title: $(element).text(),
    url: $(element).attr('href') || '',
  })).get();
}

async function getEssay(url: string, title: string): Promise<SamEssay> {
  const response = await axios.get(url);
  const $ = cheerio.load(response.data);
  
  let content = $('.posthaven-post-body').text().trim();
  
  content = content.replace(/\s+/g, " ");
  content = content.replace(/\.([a-zA-Z])/g, ". $1");
  content = content.replace(/\n/g, " ");
  content = content.replace(/\t/g, " ");
  content = content.replace(/\s+/g, " ");
  content = content.trim();
  
  const dateMatch = content.match(/([A-Z][a-z]+ [0-9]{1,2}, [0-9]{4})/);
  const date = dateMatch ? dateMatch[0] : null;

  return {
    title,
    url,
    content,
    date
  };
}

async function getAllTitles(): Promise<{ title: string; url: string }[]> {
  let allTitles: { title: string; url: string }[] = [];
  let pageNumber = 1;
  let hasNextPage = true;

  while (hasNextPage) {
    const pageUrl = `https://blog.samaltman.com/?page=${pageNumber}`;
    const titles = await getTitlesFromPage(pageUrl);
    
    if (titles.length === 0) {
      hasNextPage = false;
    } else {
      allTitles = allTitles.concat(titles);
      pageNumber++;
    }
  }

  return allTitles;
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function chunkEssay(essay: SamEssay, maxTokens: number = 1000): EssayChunk[] {
  const chunks: EssayChunk[] = [];
  const sentences = essay.content.match(/[^.!?]+[.!?]+/g) || [];
  let currentChunk = "";
  let currentTokenCount = 0;

  for (const sentence of sentences) {
    const sentenceTokens = encode(sentence);
    if (currentTokenCount + sentenceTokens.length > maxTokens && currentChunk !== "") {
      chunks.push({
        title: essay.title,
        url: essay.url,
        date: essay.date,
        chunk: currentChunk.trim(),
        tokenCount: currentTokenCount
      });
      currentChunk = "";
      currentTokenCount = 0;
    }
    currentChunk += sentence + " ";
    currentTokenCount += sentenceTokens.length;
  }

  if (currentChunk !== "") {
    chunks.push({
      title: essay.title,
      url: essay.url,
      date: essay.date,
      chunk: currentChunk.trim(),
      tokenCount: currentTokenCount
    });
  }

  return chunks;
}

(async () => {
  const links = await getAllTitles();
  
  let allChunks: EssayChunk[] = [];
  
  for (let i = 0; i < links.length; i++) {
    const essay = await getEssay(links[i].url, links[i].title);
    const chunks = chunkEssay(essay);
    allChunks = allChunks.concat(chunks);
    console.log(`Scraped and chunked (${i + 1}/${links.length}): ${essay.title} - ${chunks.length} chunks`);
    await delay(1000);
  }

  console.log(`Total chunks created: ${allChunks.length}`);
  
  fs.writeFileSync('scripts/sama.json', JSON.stringify(allChunks, null, 2));
  console.log('Data saved to sama.json');
})().catch(error => console.error('An error occurred:', error));