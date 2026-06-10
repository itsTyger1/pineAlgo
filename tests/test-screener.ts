import YahooFinance from 'yahoo-finance2';
async function run() {
  const yf = new YahooFinance();
  try {
    const res = await yf.screener({ scrIds: 'most_actives', count: 5 });
    console.log(res);

    console.log("----")
    const res3 = await yf._fetch("https://query2.finance.yahoo.com/v1/finance/screener?scrIds=ms_technology", {});
    console.log(res3);
  } catch (e) {
    console.error(e);
  }
}
run();
