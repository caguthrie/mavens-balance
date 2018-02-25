const axios = require('axios');
const yaml = require('js-yaml');
const fs = require('fs');
const parse = require('csv-parse/lib/sync');
const stringify = require('csv-stringify/lib/sync');
const moment = require('moment');
const commandLineArgs = require('command-line-args');

const optionDefinitions = [
    {
        name: 'archive',
        alias: 'a',
        type: Boolean,
        description: 'Archive balances.csv'
    },
    {
        name: 'transfer',
        alias: 't',
        type: Number,
        description: 'Anount of money to transfer between players.  Must be used with -to and -from'
    },
    {
        name: 'to',
        type: String,
        description: 'Username of anount of money to transfer money to.  Must be used with -t and -from'
    },
    {
        name: 'from',
        alias: 'f',
        type: String,
        description: 'Username of anount of money to transfer money from.  Must be used with -t and -to'
    }
];

const options = commandLineArgs(optionDefinitions);

const balancesFilePath = './balances.csv';
const transfersFile = "./transfers.csv";
const todaysISODate = getCurrentISODate();

if( options.archive ){
    const newFilename = `./archive/${todaysISODate}_mavens_archive.csv`;
    fs.renameSync(balancesFilePath, newFilename);
    fs.unlinkSync(transfersFile);
    console.log(`Success! Current working file moved to ${newFilename}`);
    process.exit(0);
}

// Get the password from secrets.yml
let password, root;
try {
    const doc = yaml.safeLoad(fs.readFileSync('./secrets.yml', 'utf8'));
    password = doc.password;
    root = doc.root;
    if (!password || !root) {
        console.log("root or password is blank, please enter both values in secrets.yml");
        process.exit(1);
    }
} catch (e) {
    console.log("Unable to open secrets.yml file due to this error: ");
    process.exit(1);
}

const {transfer, to, from} = options;
if( transfer || to || from ){
    // Make sure all options are here
    if( !(transfer && to && from) ){
        console.log("Please provide -transfer, -to, and -from options to make a transfer");
        process.exit(1);
    }

    checkPlayersAndTransferMoney(parseInt(transfer), to, from)
} else {
    // Hit Mavens API for current balances
    axios.get(`${root}/api?password=${password}&JSON=Yes&Command=AccountsList&Fields=Player,Balance,RingChips,RegChips`)
        .then(response => {
            const balancesNow = {};
            const transferData = getCSVDataWithFallback(transfersFile);
            response.data.Player.forEach((player, i) => {
                const playerTransfer = transferData.find(row => row[0] === player);
                let transferBalance = 0;
                if( playerTransfer ){
                    transferBalance = parseInt(playerTransfer[1]);
                }
                return balancesNow[player] = response.data.Balance[i] + response.data.RingChips[i] + response.data.RegChips[i] - transferBalance;
            });
            addToPnl(balancesNow);
        })
        .catch(e => {
            console.log("Unable to contact Mavens API", e);
            process.exit(1);
        });
}


function addToPnl(balancesNow){
    let currentCSVData = getCSVDataWithFallback(balancesFilePath);

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

        let newBalance;
        if( playerData.length === 1 ){
            newBalance = balancesNow[playerData[0]];
        } else {
            newBalance = balancesNow[playerData[0]] - playerData.filter((item, i) => i > 0)
                                                                .reduce((memo, val) => parseInt(memo) + parseInt(val));
        }

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
    //Sort names in case there were new players added
    currentCSVData.sort((a,b) => {
        if( a[0].toUpperCase() < b[0].toUpperCase() )
            return -1;
        else if( a[0].toUpperCase() > b[0].toUpperCase() )
            return 1;
        else
            return 0;
    });
    writeCSVData(balancesFilePath, currentCSVData);
    console.log(`Success! Saved new data for ${todaysISODate}`);
    process.exit(0);
}

function getCSVDataWithFallback(filename){
    try {
        const data = fs.readFileSync(filename, 'utf8');
        return parse(data);
    } catch(e) {
        // If file not found ...
        if( e.errno === -2 || e.errno === -4058 ){
            return [];
        } else {
            console.log(`Unable to read ${filename}`, e);
            process.exit(1);
        }
    }
}

function writeCSVData(filepath, data){
    const csvString = stringify(data);
    try {
        fs.writeFileSync(filepath, csvString, {encoding: 'utf8', flag: 'w'})
    } catch(e) {
        console.log(`unable to write file ${filepath}!`, e);
        process.exit(1);
    }
}

function getCurrentISODate(){
    return moment().format("YYYY-MM-DD");
}

function checkPlayersAndTransferMoney(amount, to, from){
    if( isNaN(amount) ){
        console.log(`--amount needs to be an amount of money. Found "${options.amount}" instead.  No changes made.`);
        process.exit(1);
    }
    axios.get(`${root}/api?password=${password}&JSON=Yes&Command=AccountsList&Fields=Player`)
        .then(playersResponse => {
            let toPlayerFromAPI = playersResponse.data.Player.find(p => p.toUpperCase() === to.toUpperCase());
            let fromPlayerFromAPI = playersResponse.data.Player.find(p => p.toUpperCase() === from.toUpperCase());
            if( !toPlayerFromAPI ){
                console.log(`Player ${to} is an invalid player.  Did you misspell?  No changes made.`);
                process.exit(1);
            } else if( !fromPlayerFromAPI ){
                console.log(`Player ${from} is an invalid player.  Did you misspell?  No changes made.`);
                process.exit(1);
            } else {
                transferMoney(amount, toPlayerFromAPI, fromPlayerFromAPI);
            }
        })
        .catch(err => {
            console.log("Transfer failed!  Unable to contact server.  No changes made.");
            process.exit(1);
        });
}

function transferMoney(amount, to, from){
    axios.get(`${root}/api?password=${password}&JSON=Yes&Command=AccountsIncBalance&Player=${to}&Amount=${amount}`)
        .then(r1 => {
            axios.get(`${root}/api?password=${password}&JSON=Yes&Command=AccountsDecBalance&Player=${from}&Amount=${amount}`)
                .then(r1 => {
                    handleTransferCSV(amount, to, from);
                    console.log(`Transferred ${amount} from ${from} to ${to} successfully!`);
                    process.exit(0);
                })
                .catch(err2 => {
                    console.log(`Added to ${to}'s balance, but the subtracting from ${from}'s balance failed!  Please un-adjust manually and try again.  Unable to contact server`);
                    process.exit(1);
                });
        })
        .catch(err => {
            console.log("Transfer failed!  Unable to contact server.  No changes made.");
            process.exit(1);
        });
}

function handleTransferCSV(amount, to, from){
    const transferData = getCSVDataWithFallback(transfersFile);
    let foundTo, foundFrom;
    transferData.forEach(row => {
        if( row[0] === to ) {
            foundTo = true;
            row[1] = parseInt(row[1]) + amount;
        } else if( row[0] === from ) {
            foundFrom = true;
            row[1] = parseInt(row[1]) - amount;
        }
    });

    if( !foundFrom )
        transferData.push([from, -amount]);

    if( !foundTo )
        transferData.push([to, amount]);

    writeCSVData(transfersFile, transferData);
}
