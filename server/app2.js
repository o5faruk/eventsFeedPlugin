const { parseFromTimeZone } = require('date-fns-timezone')

// Set the date to "2018-09-01T16:01:36.386Z"

let key = '  Pacific Time';

let timeZone = null;
if (key.includes("TZID")) {
    timeZone = key.match(/TZID=([^ ]*)/)[1];
} else {
    timeZone = "UTC"
}

const date = parseFromTimeZone('20190917', { timeZone })
console.log(date);

