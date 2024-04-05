import axios from "axios";
import * as cheerio from "cheerio";


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