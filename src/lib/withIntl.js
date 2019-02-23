import React from 'react';
import { IntlProvider, addLocaleData, injectIntl } from 'react-intl';
import PropTypes from 'prop-types';

import 'intl';
import enLocaleData from 'intl/locale-data/jsonp/en.js'; // for old browsers without window.Intl
import frLocaleData from 'react-intl/locale-data/fr';
import nlLocaleData from 'react-intl/locale-data/nl';

addLocaleData(frLocaleData);
addLocaleData(enLocaleData);
addLocaleData(nlLocaleData);

export default Page => {
  const IntlPage = injectIntl(Page);

  return class WithIntl extends React.Component {
    static displayName = `WithIntl(${Page.displayName})`;

    static propTypes = {
      locale: PropTypes.string,
      messages: PropTypes.object,
      now: PropTypes.number,
    };

    static defaultProps = {
      locale: 'fr',
    };

    // Note: when adding withIntl to a child component, getInitialProps doesn't get called
    // and it doesn't populate the messages in the props
    static async getInitialProps(context) {
      let props;
      if (typeof Page.getInitialProps === 'function') {
        props = await Page.getInitialProps(context);
      }

      // Get the `locale` and `messages` from the request object on the server.
      // In the browser, use the same values that the server serialized.
      const { req } = context;
      const { locale, messages } = req || window.__NEXT_DATA__.props.pageProps;

      // Always update the current time on page load/transition because the
      // <IntlProvider> will be a new instance even with pushState routing.
      const now = Date.now();

      return { ...props, locale, messages, now };
    }

    render() {
      const { locale, messages, now, ...props } = this.props;

      const intlProps = {};
      if (locale) {
        intlProps.locale = locale;
      }
      if (messages) {
        intlProps.messages = messages;
      }

      // Note: If we don't add locale and messages as props, it falls back to the closest parent <IntlProvider />
      return (
        <IntlProvider {...intlProps} initialNow={now}>
          <IntlPage {...props} />
        </IntlProvider>
      );
    }
  };
};
