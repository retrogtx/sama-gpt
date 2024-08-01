import axios from "axios";
import * as Cheerio from "cheerio";
import { encode } from "gpt-3-encoder";

const BASE_URL = "https://blog.samaltman.com"

const getLinks = async () => {
    const html = await axios.get(BASE_URL); 
    const $ = Cheerio.load(html.data);
    console.log(html);
}

(async () => {
    await getLinks();
})();