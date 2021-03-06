import models, { Op } from '../src/server/models';
import libemail from '../src/server/lib/email';

const run = async () => {
  const posts = await models.Post.findAll({ where: { status: { [Op.in]: ['PUBLISHED', 'PENDING'] } } });
  console.log('> reprocessing', posts.length, 'emails');
  const promises = [];
  posts.map(p => {
    if (!p.email) {
      // console.log('> no email for post id', p.id, '- skipping');
      return;
    }
    if (!p.email['body-html']) {
      console.log('>>> missing body-html for Post.id', p.id);
    }
    const html = libemail.getHTML(p.email);
    if (html === p.html) {
      // console.log('> no change for post id', p.id);
      return;
    }
    console.log(
      '>>> old html length',
      p.html.length,
      'new length:',
      html.length,
      'saving:',
      Math.round(((p.html.length - html.length) / p.html.length) * 100) + '%',
    );
    if (p.html.length !== html.length) {
      // console.log('>>> p.email', p.email['stripped-html']);
      // console.log('>>> html', html);
      // console.log('------------------------');
    }
    promises.push(p.update({ html }));
  });
  await Promise.all(promises);
  console.log('> reprocessing done');
  process.exit(0);
};

run();
