import puppeteer from 'puppeteer';
import fs from 'fs';
import readline from 'readline';
import { once } from 'events';
import util from 'util';
import { exec } from 'child_process';
const execute = util.promisify(exec);

const executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const folderPage = 'https://huskycast.hosted.panopto.com/Panopto/Pages/Sessions/List.aspx#folderID=%223abacc4d-7d75-4cfe-8d67-acc20103dd48%22&maxResults=250';

const cookies = [];

const downloadVideo = async (browser, link) => {
    const page = await browser.newPage();
    await page.setCookie(...cookies);

    let vidUrl = null;

    page.on('response', response => {
        if (response.url().includes('master.m3u8')) {
            vidUrl = response.url();
        }
    });

    await page.goto(link, {
        waitUntil: 'networkidle0',
    });

    const title = await page.title();

    console.log(`Downloading ${title}`);

    await page.close();

    await execute(`youtube-dl --cookies cookies.txt "${vidUrl}" -o "output/${title}.%(ext)s"`);
};

(async () => {
    const browser = await puppeteer.launch({ headless: true, executablePath });
    const page = await browser.newPage();


    const lineReader = readline.createInterface({
        input: fs.createReadStream('./cookies.txt')
    });
      
    lineReader.on('line', (line) => {
        const l = line.split('\t');
        if (l[5]) {
            cookies.push({
                domain: l[0],
                path: l[2],
                name: l[5],
                value: l[6],
            });
        }
    });
    await once(lineReader, 'close');
    await page.setCookie(...cookies);

    await page.goto(folderPage, {
        waitUntil: 'networkidle0',
    });

    const resultsSelector = 'a.detail-title';
    await page.waitForSelector(resultsSelector);

    const links = await page.evaluate(() => Array.from(document.querySelectorAll('a.detail-title'), element => element.href));

    await page.close();

    for (let i = 0; i < links.length; i++) {
        console.log(`Downloading ${i + 1} of ${links.length}`);
        if (links[i]) {
            await downloadVideo(browser, links[i]);
        }
    }

    await browser.close();
})();