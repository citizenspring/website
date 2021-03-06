import React from 'react';
import App, { Container } from 'next/app';
import Router from 'next/router';
import NProgress from 'nprogress';
import { ThemeProvider } from 'styled-components';
import { ApolloProvider } from 'react-apollo';
import withData from '../lib/withData';

import theme from '../constants/theme';
import { getGoogleMapsScriptUrl, loadGoogleMaps } from '../lib/google-maps';

import '../../node_modules/nprogress/nprogress.css';
import '../static/styles/app.css';

Router.onRouteChangeStart = () => NProgress.start();

Router.onRouteChangeComplete = () => NProgress.done();

Router.onRouteChangeError = () => NProgress.done();

class OpenCollectiveEmail extends App {
  static async getInitialProps({ Component, ctx }) {
    let pageProps = {};

    if (Component.getInitialProps) {
      pageProps = await Component.getInitialProps(ctx);
    }

    const scripts = {};

    // we always load the scripts otherwise it fails when we move from one page to another without server refresh
    if (ctx.req) {
      scripts['google-maps'] = getGoogleMapsScriptUrl();
    } else {
      await loadGoogleMaps();
    }

    return { pageProps, scripts };
  }

  render() {
    const { client, Component, pageProps, scripts } = this.props;

    return (
      <Container>
        <ApolloProvider client={client}>
          <ThemeProvider theme={theme}>
            <Component {...pageProps} />
          </ThemeProvider>
        </ApolloProvider>
        {Object.keys(scripts).map(key => (
          <script key={key} type="text/javascript" src={scripts[key]} />
        ))}
      </Container>
    );
  }
}

export default withData(OpenCollectiveEmail);
