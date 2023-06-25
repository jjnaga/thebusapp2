import moment from 'moment';
(async () => {
  let wtf = moment();

  for (let i = 0; i < 10; i++) {
    console.log(wtf);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
})();
