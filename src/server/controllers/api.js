import config from 'config';
import { verifyJwt } from '../lib/auth';
import { get } from 'lodash';
import request from 'request-promise';
import { pluralize } from '../lib/utils';
import models from '../models';
import { db } from '../lib/test';
import { handleIncomingEmail } from './emails';

export const retrieveEmail = async ({ mailServer, messageId }) => {
  const requestOptions = {
    json: true,
    auth: {
      user: 'api',
      pass: get(config, 'email.mailgun.apiKey'),
    },
  };
  const url = `https://${mailServer}.api.mailgun.net/v3/domains/${get(config, 'server.domain')}/messages/${messageId}`;
  return await request.get(url, requestOptions);
};

/**
 * Publish an email to the group that is stored on the mail server
 * @param {*} req
 * @param {*} res
 * @param {*} next
 */
export async function publishEmail(req, res, next) {
  const { groupSlug } = req.query;
  let token;
  try {
    token = verifyJwt(req.query.token);
  } catch (e) {
    if (e && e.name === 'TokenExpiredError') {
      throw new Error(
        `The token has expired. Please resend your email to ${groupSlug}@${get(config, 'server.domain')}`,
      );
    }
  }
  let email;
  try {
    email = await retrieveEmail(token);
  } catch (e) {
    if (e.statusCode === 404) {
      return res.status(404).send('Email not found');
    } else {
      console.error('>>> retrieveEmail error', token, 'response:', JSON.stringify(e));
      return res.send('Unknown error');
    }
  }
  const redirect = await handleIncomingEmail(email);

  return res.redirect(redirect);
}

/**
 * Approves an edit
 * @param {*} req
 * @param {*} res
 * @param {*} next
 */
export async function approve(req, res, next) {
  let token;
  try {
    token = verifyJwt(req.query.token);
  } catch (e) {
    if (e && e.name === 'TokenExpiredError') {
      return res.status(500).send(`The token has expired.`);
    }
  }
  const GroupId = get(token, 'data.group.id');
  if (!GroupId) {
    return res.status(500).send(`Invalid token: GroupId missing`);
  }
  const group = await models.Group.findById(GroupId);
  if (!group) {
    return res.status(500).send(`Cannot approve: GroupId ${GroupId} not found`);
  }
  await group.publish();
  return res.redirect(`/${group.slug}`);
}

export async function follow(req, res, next) {
  let token;
  try {
    token = verifyJwt(req.query.token);
  } catch (e) {
    if (e && e.name === 'TokenExpiredError') {
      throw new Error(
        `The token has expired. Please resend your email to ${req.query.groupSlug}@${get(config, 'server.domain')}`,
      );
    }
  }
  let member = await models.Member.findOne({ where: token.data });
  if (member) {
    console.error(`api.follow: membership already exists`, member.id);
    return res.send(`It looks like you've already subscribed to those notifications`);
  }
  const users = await models.User.findAll({ attributes: ['id', 'email'] });
  member = await models.Member.create(token.data);
  let msg;
  if (member.PostId) {
    msg = `You have successfully subscribed to future updates to this thread`;
  } else {
    msg = `You have successfully subscribed to new messages sent to this group`;
  }
  return res.send(msg);
}

export async function unfollow(req, res, next) {
  let token;
  try {
    token = verifyJwt(req.query.token);
  } catch (e) {
    if (e && e.name === 'TokenExpiredError') {
      throw new Error(
        `The token has expired. Please resend your email to ${req.query.groupSlug}@${get(config, 'server.domain')}`,
      );
    }
  }
  const member = await models.Member.findById(token.data.MemberId);
  let msg;
  if (!member) {
    console.error(`api.unfollow: can't find Member.id`, token.data.MemberId);
    return res.send(`It looks like you've already unsubscribed from those notifications`);
  }
  if (member.PostId) {
    msg = `You have successfully unsubscribed from future updates to this thread`;
  } else {
    msg = `You have successfully unsubscribed from new messages sent to this group`;
  }
  await member.destroy();
  return res.send(msg);
}

export async function reset(req, res) {
  if (!req.query.secret || req.query.secret !== process.env.SECRET) {
    return res.send('invalid secret');
  }
  await db.reset();
  if (req.query.users) {
    const emails = req.query.users.split(',');
    await models.User.bulkCreate(
      emails.map(e => {
        return { email: e };
      }),
    );
    return res.send(`db reset and ${emails.length} ${pluralize(emails.length, 'user')} created (${emails.join(', ')})`);
  }
  return res.send('db reset');
}
