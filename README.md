# Mavens Balance
 
A script to export current Mavens balances to a csv

## Installation
 
1) Run `npm i`
2) Create `secrets.yaml` file with the following:
    ```
    root: mavens url root
    password: your password
    ```
 
## Usage
 
Run the program, creating or appending to balances.csv: `node mavens_pnl.js`

Run the program in archive mode, moving balances.csv to the archive folder with a datestamp: `node mavens_pnl.js -a`
 
## License
 
The MIT License (MIT)

Copyright (c) 2018 Chris Guthrie

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
