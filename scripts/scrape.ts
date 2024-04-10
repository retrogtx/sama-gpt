import axios from "axios";
import * as cheerio from "cheerio";
import { encode } from 'gpt-3-encoder';
import { SamChunk, SamEssay, SamJSON } from "@/types";
import fs from 'fs';

const BASE_URL = "https://blog.samaltman.com/";

const getLinks = async () => {
    try {
        const response = await axios.get(BASE_URL);
        const $ = cheerio.load(response.data);

        const links: { url: string; title: string }[] = [];
        $("article.post").each((index: number, article: cheerio.Element) => {
            const link = $(article).find("a").first();
            const url = link.attr("href") ?? "";
            const title = link.text().trim();
            links.push({ url, title });
        });

        return links;
    } catch (error) {
        console.error("Error fetching data:", error);
        return [];
    }
};

getLinks()
    .then((links) => {
        console.log("Links and titles:");
        links.forEach((link, index) => {
            console.log(`${index + 1}. ${link.title}: ${BASE_URL}${link.url}`);
        });
    })
    .catch((error) => {
        console.error("Error:", error);
    });

const getEssay = async (linkObj: { url: string; title: string }) => {
    const { title, url } = linkObj;

    let essay: SamEssay = {
        title: "",
        url: "",
        date: "",
        thanks: "",
        content: "",
        length: 0,
        tokens: 0,
        chunks: []
    };

    const fullLink = BASE_URL + url;
    const html = await axios.get(fullLink);
    const $ = cheerio.load(html.data);
    const tables = $("table");

    tables.each((i, table) => {
        if (i === 1) {
            const text = $(table).text();

            let cleanedText = text.replace(/\s+/g, " ");
            cleanedText = cleanedText.replace(/\.([a-zA-Z])/g, ". $1");

            const date = cleanedText.match(/([A-Z][a-z]+ [0-9]{4})/);
            let dateStr = "";
            let textWithoutDate = "";

            if (date) {
                dateStr = date[0];
                textWithoutDate = cleanedText.replace(date[0], "");
            }

            let essayText = textWithoutDate.replace(/\n/g, " ");
            let thanksTo = "";

            const split = essayText.split(". ").filter((s) => s);
            const lastSentence = split[split.length - 1];

            if (lastSentence && lastSentence.includes("Thanks to")) {
                const thanksToSplit = lastSentence.split("Thanks to");

                if (thanksToSplit[1].trim()[thanksToSplit[1].trim().length - 1] === ".") {
                    thanksTo = "Thanks to " + thanksToSplit[1].trim();
                } else {
                    thanksTo = "Thanks to " + thanksToSplit[1].trim() + ".";
                }

                essayText = essayText.replace(thanksTo, "");
            }

            const trimmedContent = essayText.trim();

            essay = {
                title,
                url: fullLink,
                date: dateStr,
                thanks: thanksTo.trim(),
                content: trimmedContent,
                length: trimmedContent.length,
                tokens: encode(trimmedContent).length,
                chunks: []
            };
        }
    });

    return essay;
};

const chunkEssay = async (essay: SamEssay) => {
    const { title, url, date, thanks, content, ...chunklessSection } = essay;

    let essayTextChunks = [];

    if (encode(content).length > CHUNK_SIZE) {
        const split = content.split(". ");
        let chunkText = "";

        for (let i = 0; i < split.length; i++) {
            const sentence = split[i];
            const sentenceTokenLength = encode(sentence);
            const chunkTextTokenLength = encode(chunkText).length;

            if (chunkTextTokenLength + sentenceTokenLength.length > CHUNK_SIZE) {
                essayTextChunks.push(chunkText);
                chunkText = "";
            }

            if (sentence[sentence.length - 1].match(/[a-z0-9]/i)) {
                chunkText += sentence + ". ";
            } else {
                chunkText += sentence + " ";
            }
        }

        essayTextChunks.push(chunkText.trim());
    } else {
        essayTextChunks.push(content.trim());
    }

    const essayChunks = essayTextChunks.map((text) => {
        const trimmedText = text.trim();

        const chunk: SamChunk = {
            essay_title: title,
            essay_url: url,
            essay_date: date,
            essay_thanks: thanks,
            content: trimmedText,
            content_length: trimmedText.length,
            content_tokens: encode(trimmedText).length,
            embedding: []
        };

        return chunk;
    });

    if (essayChunks.length > 1) {
        for (let i = 0; i < essayChunks.length; i++) {
            const chunk = essayChunks[i];
            const prevChunk = essayChunks[i - 1];

            if (chunk.content_tokens < 100 && prevChunk) {
                prevChunk.content += " " + chunk.content;
                prevChunk.content_length += chunk.content_length;
                prevChunk.content_tokens += chunk.content_tokens;
                essayChunks.splice(i, 1);
                i--;
            }
        }
    }

    const chunkedSection: SamEssay = {
        ...essay,
        chunks: essayChunks
    };

    return chunkedSection;
};

(async () => {
    const links = await getLinks();

    let essays = [];

    for (let i = 0; i < links.length; i++) {
        const essay = await getEssay(links[i]);
        const chunkedEssay = await chunkEssay(essay);
        essays.push(chunkedEssay);
    }

    const json: SamJSON = {
        current_date: "2023-03-01",
        author: "Paul Graham",
        url: "http://www.paulgraham.com/articles.html",
        length: essays.reduce((acc, essay) => acc + essay.length, 0),
        tokens: essays.reduce((acc, essay) => acc + essay.tokens, 0),
        essays
    };

    fs.writeFileSync("scripts/pg.json", JSON.stringify(json));
})();