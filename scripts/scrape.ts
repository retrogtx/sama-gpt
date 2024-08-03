import axios from 'axios';
import * as cheerio from 'cheerio';

interface SamEssay {
  title: string;
  url: string;
  content: string;
}

async function getTitles(): Promise<{ title: string; url: string }[]> {
  const response = await axios.get('https://blog.samaltman.com/');
  const $ = cheerio.load(response.data);
  
  return $('.post-title h2 a').map((_, element) => ({
    title: $(element).text(),
    url: $(element).attr('href') || '',
  })).get();
}

async function getEssay(url: string, title: string): Promise<SamEssay> {
  const response = await axios.get(url);
  const $ = cheerio.load(response.data);
  
  const content = $('.posthaven-post-body').text().trim();
  
  return {
    title,
    url,
    content,
  };
}

(async () => {
  const links = await getTitles();
  
  let essays: SamEssay[] = [];
  
  for (let i = 0; i < links.length; i++) {
    const essay = await getEssay(links[i].url, links[i].title);
    essays.push(essay);
    console.log(`Scraped: ${essay.title}`); // Log progress
  }

  console.log(JSON.stringify(essays, null, 2)); // Print the essays array after the loop
})().catch(error => console.error('An error occurred:', error));