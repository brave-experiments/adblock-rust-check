/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Example invocations:
 * Basic checking a URL:
 *   node scripts/check.js  --host www.cnet.com --location https://s0.2mdn.net/instream/html5/ima3.js
 * Checking with a particular resource type:
 *   node scripts/check.js --host www.scrumpoker.online --location https://www.scrumpoker.online/js/angular-google-analytics.js -O script
 * Checking a URL against a particular adblock list:
 *   node scripts/check.js  --uuid 03F91310-9244-40FA-BCF6-DA31B832F34D --host slashdot.org --location https://s.yimg.jp/images/ds/ult/toppage/rapidjp-1.0.0.js
 * Checking a URL from a loaded DAT file:
 *   node scripts/check.js --dat ./out/SafeBrowsingData.dat --host excellentmovies.net --location https://excellentmovies.net
 * Checking a URL from a list URL:
 *   node scripts/check.js --http https://easylist-downloads.adblockplus.org/easylist.txt --host excellentmovies.net --location http://simple-adblock.com/adblocktest/files/adbanner.gif
 * Checking a list of URLs:
 *   node scripts/check.js  --host www.cnet.com --list ./test/data/sitelist.txt
 * Get stats for a particular adblock list:
 *   node scripts/check.js  --uuid 67F880F5-7602-4042-8A3D-01481FD7437A --stats
*/

const Url = require('url')
const commander = require('commander')
const { lists } = require('adblock-rs')
const { makeAdBlockClientFromListUUID, makeAdBlockClientFromDATFile, makeAdBlockClientFromListURL, makeAdBlockClientFromString, makeAdBlockClientFromFilePath, readSiteList } = require('../lib/util')


commander
  .option('-u, --uuid [uuid]', 'UUID of the list to use')
  .option('-d, --dat [dat]', 'file path of the adblock .dat file')
  .option('-f, --filter [filter]', 'Brave filter rules')
  .option('-F, --filter-path [filterPath]', 'Brave filter rules file path')
  .option('-w, --http [http]', 'Web filter to use')
  .option('-h, --host [host]', 'host of the page that is being loaded')
  .option('-l, --location [location]', 'URL to use for the check')
  .option('-o, --output [output]', 'Optionally saves a DAT file')
  .option('-L, --list [list]', 'Filename for list of sites to check')
  .option('-s, --stats', 'If specified outputs parsing stats')
  .option('-C, --cache', 'Optionally cache results and use cached results')
  .option('-O, --filter-option [filterOption]', 'Filter option to use', 'image')
  .parse(process.argv)

let p = Promise.reject(new Error('Usage: node check.js --location <location> --host <host> [--uuid <uuid>]'))

if ((commander.host && (commander.location || commander.list)) || commander.stats) {
  p.catch(() => {})
  if (commander.uuid) {
    p = makeAdBlockClientFromListUUID(commander.uuid, parseOptions)
  } else if (commander.dat) {
    p = makeAdBlockClientFromDATFile(commander.dat)
  } else if (commander.http) {
    p = makeAdBlockClientFromListURL(commander.http, undefined, parseOptions)
  } else if (commander.filter) {
    p = makeAdBlockClientFromString(commander.filter, parseOptions)
  } else if (commander.filterPath) {
    p = makeAdBlockClientFromFilePath(commander.filterPath, parseOptions)
  } else {
    const defaultLists = new lists("default")
      .map((listObj) => listObj.url)
    console.log('defaultLists: ', defaultLists)
    p = makeAdBlockClientFromListURL(defaultLists, undefined, {})
  }
}

p.then((adBlockClient) => {
  if (commander.stats) {
    console.log('Parsing stats:', adBlockClient.getParsingStats())
    return
  }
  if (commander.location) {
    console.log('params:', commander.location, commander.filterOption, commander.host)
    console.log('Matches: ', adBlockClient.check(
      commander.location,
      `https://${commander.host}`,
      commander.filterOption))
  } else {
    const siteList = readSiteList(commander.list)
    let matchCount = 0
    let skipCount = 0
    console.time('check')
    siteList.forEach((site) => {
      if (adBlockClient.check(site, commander.filterOption, commander.host)) {
        matchCount++
      } else {
        skipCount++
      }
    })
    console.timeEnd('check')
    console.log('Matching:', matchCount)
    console.log('Skipped:', skipCount)
  }
  if (commander.output) {
    require('fs').writeFileSync(commander.output, adBlockClient.serialize())
  }
}).catch((e) => {
  console.log('Error:', e)
})
