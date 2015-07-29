import B from 'bluebird';

let p = new B.resolve('123');

async function func() {
  return await p;
}

export default {func: func};
