import axios from "axios";
import * as Cheerio from "cheerio";
import { encode } from "gpt-3-encoder";

const BASE_URL = "https://blog.samaltman.com"

const getTitles = async () => {
    const html = await axios.get(BASE_URL); 
    const $ = Cheerio.load(html.data);
    const postTitle = $("h2");
    const linksArr: { url: string; title: string }[] = [];

    postTitle.each((i, title) => {
        const links = $(title).find("a");
        links.each((i, link) => {
            const url = $(link).attr("href");
            if (url) {
                const title = $(link).text();
                const linkObj = {
                    url,
                    title
                }
                linksArr.push(linkObj);
            }
        });
    })
    return linksArr;
};

(async () => {
    const titles = await getTitles(); 
    console.log(titles); 
})();