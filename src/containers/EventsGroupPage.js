import React from 'react';
import PropTypes from 'prop-types';
import withIntl from '../lib/withIntl';
import PostList from './PostList';
import TopBar from '../components/TopBar';
import Footer from '../components/Footer';

import { Content, DescriptionBlock } from '../styles/layout';
import TitleWithActions from '../components/TitleWithActions';
import EditableText from '../components/EditableText';
import { mailto } from '../lib/utils';

import env from '../env.frontend';
import { FormattedMessage } from 'react-intl';
import Metadata from '../components/Group/EventsMetadata';
import MapMarkers from '../components/MapMarkers';
import TagsSelector from '../components/TagsSelectorWithData';

import { get } from 'lodash';
import { Box, Flex } from '@rebass/grid';

class EventsGroupPage extends React.Component {
  static propTypes = {
    group: PropTypes.object.isRequired,
    intl: PropTypes.object.isRequired,
    tag: PropTypes.string,
  };

  constructor(props) {
    super(props);
  }

  render() {
    const { group, tag } = this.props;
    const groupEmail = `${group.slug}@${env.DOMAIN}`;
    const template = get(group, 'settings.template');
    const actions = [
      {
        label: 'follow',
        href: mailto(
          groupEmail,
          'follow',
          `Follow ${group.name}`,
          'Just send this email be notified whenever a new event is published in this group',
        ),
        style: 'standard',
      },
      {
        label: 'add event',
        href: `/${group.slug}/events/new`,
      },
    ];

    return (
      <div>
        <TopBar group={group} />
        <Content>
          <TitleWithActions title={group.name} actions={actions} />
          <Metadata group={group} />
          <DescriptionBlock>
            <EditableText mailto={mailto(groupEmail, 'edit', group.name, group.description)} html={group.description}>
              {!group.description && (
                <FormattedMessage id="group.description.empty" defaultMessage="no group description" />
              )}
            </EditableText>
          </DescriptionBlock>
          <TagsSelector groupSlug={group.slug} selected={tag} />
          <Box mb={3}>
            <MapMarkers group={group} />
          </Box>
          <PostList groupSlug={group.slug} posts={group.posts} />
        </Content>
        <Footer group={group} />
      </div>
    );
  }
}

export default withIntl(EventsGroupPage);