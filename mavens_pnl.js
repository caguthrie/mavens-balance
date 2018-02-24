const axios = require('axios');
const yaml = require('js-yaml');
const fs = require('fs');
const parse = require('csv-parse/lib/sync');
const stringify = require('csv-stringify/lib/sync');
const moment = require('moment');
const commandLineArgs = require('command-line-args')

const optionDefinitions = [
    {
        name: 'archive',
        alias: 'a',
        type: Boolean,
        description: 'Archive balances.csv'
    }
];

const options = commandLineArgs(optionDefinitions);

const filePath = './balances.csv';
const todaysISODate = getCurrentISODate();

if( options.archive ){
    const newFilename = `./archive/${todaysISODate}_mavens_archive.csv`;
    fs.rename(filePath, newFilename);
    console.log(`Success! Current working file moved to ${newFilename}`);
    process.exit(0);
}

// Get the password from secrets.yml
let password, root;
try {
    const doc = yaml.safeLoad(fs.readFileSync('./secrets.yml', 'utf8'));
    password = doc.password;
    root = doc.root;
    if( !password || !root ) {
        console.log("root or password is blank, please enter both values in secrets.yml");
        process.exit(1);
    }
} catch (e) {
    console.log("Unable to open secrets.yml file due to this error: ");
    process.exit(1);
}

// Hit Mavens API
axios.get(`${root}/api?password=${password}&JSON=Yes&Command=AccountsList&Fields=Player,Balance`)
    .then(response => {
        const balancesNow = {};
        response.data.Player.forEach((player, i) => {
            return balancesNow[player] = response.data.Balance[i];
        });
        addToPnl(balancesNow);
    })
    .catch(e => {
        console.log("Unable to contact Mavens API", e);
        process.exit(1);
    });


function addToPnl(balancesNow){
    let currentCSVData = getCSVData();

    // If the file doesn't exist yet, create a new dataset
    if( currentCSVData.length === 0 ){
        currentCSVData = [[""]];
        Object.keys(balancesNow).forEach(player => {
            currentCSVData.push([player]);
        });
    }

    if( todaysISODate <= currentCSVData[0][currentCSVData[0].length-1] ){
        console.log(`Already run for ${todaysISODate}.  Nothing done.`);
        process.exit(0);
    }

    // Add new balance for each player
    currentCSVData.forEach((playerData, i) => {
        // Special case for headers
        if( i === 0 ){
            playerData.push(todaysISODate);
            return;
        }

        const newBalance = balancesNow[playerData[0]];
        // Fall back to zero balance if player no longer exists
        playerData.push(newBalance || 0);
        if( isNaN(newBalance) ){
            console.log(`Can't find data for player named ${playerData[0]}. Assuming player removed and balance is zero`);
        } else {
            delete balancesNow[playerData[0]];
        }
    });

    // Cover corner case of new players
    if( Object.keys(balancesNow).length > 0 ){
        console.log("New players found: ", balancesNow);
        Object.keys(balancesNow).forEach(player => {
            const newPlayerData = currentCSVData[0].map((notUsed, i) => {
                if( i === 0 )
                    return player;
                else if( i === currentCSVData[0].length - 1 )
                    return balancesNow[player];
                else
                    return 0;
            });
            currentCSVData.push(newPlayerData);
        });
    }
    writeCSVData(currentCSVData);
    console.log(`Success! Saved new data for ${todaysISODate}`);
    process.exit(0);
}

function getCSVData(){
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        return parse(data);
    } catch(e) {
        if( e.errno === -2 || e.errno === -4058 ){
            return [];
        } else {
            console.log("Unable to read balances.csv", e);
            process.exit(1);
        }
    }
}

function writeCSVData(data){
    const csvString = stringify(data);
    try {
        fs.writeFileSync(filePath, csvString, {encoding: 'utf8', flag: 'w'})
    } catch(e) {
        console.log("unable to write file!", e);
        process.exit(1);
    }
}

function getCurrentISODate(){
    return moment().format("YYYY-MM-DD");
}
