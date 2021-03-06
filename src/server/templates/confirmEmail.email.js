import config from 'config';
import React from 'react';
import Layout from './email.layout';
import { get } from 'lodash';
import { quoteEmail } from '../lib/email';

const styles = {
  btn: {
    display: 'block',
    maxWidth: '240px',
    borderRadius: '16px',
    backgroundColor: '#3399FF',
    color: 'white',
    textDecoration: 'none',
    padding: '5px 10px',
    fontSize: '16px',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  disclaimer: {
    color: '#555',
    fontSize: '12px',
  },
};

export const subject = () => {
  return `Action required: your email is pending`;
};

export const previewText = ({ groupSlug }) => {
  return `Please confirm sending your email to ${groupSlug}@${get(config, 'server.domain')}`;
};

export const text = ({ groupSlug, confirmationUrl, post, action }) => {
  const groupUrl = `${get(config, 'server.baseUrl')}/${groupSlug}`;
  return `Hi there! 👋<

Since this is the first time you that are sending an email to the ${get(
    config,
    'collective.name',
  )} collective, we ask you to kindly confirm that you are a human ☺️ We also want to make sure that you understand that all emails sent to this email address are published publicly on ${groupUrl}

To ${action.label.toLowerCase()}, click on the link below:
${confirmationUrl}


Note: If you'd like to use another identity, we recommend that you send your email from a different email address.


${quoteEmail(post)}
`;
};

export const body = data => {
  const { groupSlug, confirmationUrl, post, action } = data;
  const groupUrl = `${get(config, 'server.baseUrl')}/${groupSlug}`;
  return (
    <Layout data={data}>
      <p>Hi there! 👋</p>
      <p>
        Since this is the first time you that are sending an email to the {get(config, 'collective.name')} collective,
        we ask you to kindly confirm that you are a human ☺️🤖
      </p>
      <p>
        We also want to make sure that you understand that all emails sent to this email address are published publicly
        on <a href={groupUrl}>{groupUrl}</a>.
      </p>
      <p>To continue, click on the button below.</p>
      <center>
        <a style={styles.btn} href={confirmationUrl}>
          {action.label}
        </a>
      </center>
      <p style={styles.disclaimer}>
        Note: If you'd like to use another identity, we recommend that you send your email from a different email
        address.
      </p>

      {quoteEmail(post, 'html')}
    </Layout>
  );
};
