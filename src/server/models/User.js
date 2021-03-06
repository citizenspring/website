'use strict';

import * as auth from '../lib/auth';
import libemail from '../lib/email';
import { isISO31661Alpha2 } from 'validator';
import crypto from 'crypto';
import request from 'request-promise';
import { parseEmailAddress, capitalize } from '../lib/utils';
import LRU from 'lru-cache';
import debugLib from 'debug';
const debug = debugLib('user');

module.exports = (sequelize, DataTypes) => {
  const { models, Op } = sequelize;
  const User = sequelize.define(
    'User',
    {
      firstName: DataTypes.STRING,
      lastName: DataTypes.STRING,
      name: {
        type: DataTypes.VIRTUAL,
        get() {
          return this.getName();
        },
      },
      email: {
        type: DataTypes.STRING,
        unique: true, // need that? http://stackoverflow.com/questions/16356856/sequelize-js-custom-validator-check-for-unique-username-password
        set(val) {
          if (val && val.toLowerCase) {
            this.setDataValue('email', val.toLowerCase());
          }
        },
        validate: {
          len: {
            args: [6, 128],
            msg: 'Email must be between 6 and 128 characters in length',
          },
          isEmail: {
            msg: 'Email must be valid',
          },
        },
      },
      image: {
        type: DataTypes.STRING,
        get() {
          if (this.getDataValue('image')) {
            return this.getDataValue('image');
          }
          return User.fetchGravatar(this.email);
        },
      },
      token: DataTypes.STRING,
      gender: DataTypes.STRING,
      zipcode: DataTypes.STRING,
      countryCode: {
        type: DataTypes.STRING,
        length: 2,
        validate: {
          len: 2,
          isValidCountryCode(value) {
            if (!isISO31661Alpha2(value)) {
              throw new Error('Invalid Country Code.');
            }
          },
        },
      },
      website: DataTypes.STRING,
      twitter: DataTypes.STRING,
      facebook: DataTypes.STRING,
      preferredLanguage: DataTypes.STRING,
      languages: DataTypes.ARRAY(DataTypes.STRING),
    },
    {
      paranoid: true,
      hooks: {
        beforeValidate: user => {
          if (user.name && (!user.firstName || user.firstName === 'anonymous')) {
            const spaceIndex = user.name.indexOf(' ');
            if (spaceIndex === -1) {
              user.firstName = user.name;
            } else {
              user.firstName = user.name.substr(0, spaceIndex);
              user.lastName = user.name.substr(spaceIndex + 1);
            }
          }
          if (!user.firstName) {
            const account = user.email.substr(0, user.email.indexOf('@'));
            user.firstName = account.split('.')[0];
          }
        },
      },
    },
  );

  // We keep the response from gravatar for 2h
  const cache = new LRU({
    max: 50,
    stale: true,
  });

  User.findByEmail = email => User.findOne({ where: { email: `${email}`.toLowerCase() } });

  /**
   * Signing in the user
   * If doesn't exist, creates a new user and send short code by email
   * If short code provided, verify it matches then generate token
   */
  User.signin = async userData => {
    let user;
    user = await User.findByEmail(userData.email);
    if (!user) {
      try {
        user = await User.create(userData);
      } catch (e) {
        console.error('>>> User.signin error: ', e.message);
      }
    }
    // If the user hasn't provided a token, we send a short code by email
    if (!userData.token) {
      await user.generateShortCode();
      await libemail.sendTemplate(
        'shortcode',
        {
          shortcode: user.token,
        },
        user.email,
      );
      return user;
    }
    // if the token is a short code, we generate a long lived token
    if (userData.token.length === 5) {
      if (userData.token !== user.token) {
        throw new Error('Invalid short code');
      }
      await user.generateToken();
      return user;
    }
  };

  User.findOrCreate = async userData => {
    const user = await User.findByEmail(userData.email);
    if (user) {
      if ((!user.firstName || user.firstName === 'anonymous') && userData.name) {
        // if we didn't have the name of the user before (i.e. because added by someone else just by email),
        // we add it
        user.name = userData.name;
        await user.save();
      }
      return user;
    }
    try {
      return await User.create(userData);
    } catch (e) {
      console.error('User.findOrCreate: Unable to create User', userData, e);
      throw e;
    }
  };

  /**
   * Instance Methods
   */
  User.prototype.getName = function() {
    if (this.getDataValue('name')) return this.getDataValue('name');
    const nameParts = [];
    if (this.getDataValue('firstName')) nameParts.push(this.getDataValue('firstName'));
    if (this.getDataValue('lastName')) nameParts.push(this.getDataValue('lastName'));
    if (nameParts.length > 0 && nameParts[0] !== 'anonymous') return nameParts.join(' ');

    const name = parseEmailAddress(this.email).groupSlug;
    const tokens = name.match(/^([^(.| )]+)(?: |\.)?(.*)$/);
    this.firstName = capitalize(tokens[1]);
    let res = tokens[1];
    if (tokens.length > 1) {
      this.lastName = capitalize(tokens[2]);
      res += ' ' + tokens[2];
    }
    return res;
  };

  /**
   * We check if there is a gravatar associatied to the user's email
   * We
   */
  User.fetchGravatar = async function(email) {
    email = email || this.email;
    debug('>>> User.fetchGravatar', email, cache.get(email));
    if (cache.get(email) === 404) return null;
    if (cache.get(email)) return cache.get(email);
    const md5 = crypto
      .createHash('md5')
      .update(email)
      .digest('hex');
    const imageUrl = `https://www.gravatar.com/avatar/${md5}?d=404`;
    request(imageUrl)
      .then(() => {
        console.info(`Saving avatar in memory cache: ${imageUrl}`);
        cache.set(email, imageUrl);
      })
      .catch(e => {
        console.info(`No avatar found.`, imageUrl);
        cache.set(email, 404);
      });
  };

  User.prototype.generateToken = async function(redirect) {
    const data = { id: this.id, _salt: Math.floor(Math.random() * 9999999999) };
    this.token = auth.createJwt('login', data, auth.TOKEN_EXPIRATION_SESSION);
    return await this.save();
  };

  User.prototype.generateShortCode = async function() {
    const shortcode = Math.floor(Math.random() * 89999) + 10000;
    this.token = shortcode;
    return await this.save();
  };

  User.prototype.isAdmin = async function(group) {
    const membership = await models.Member.count({
      where: { UserId: this.id, GroupId: group.GroupId, role: 'ADMIN' },
    });
    return membership === 1;
  };

  /**
   * Create a group and add this user as ADMIN and FOLLOWER
   */
  User.prototype.createGroup = async function(groupData) {
    let group;
    try {
      group = await models.Group.create({ ...groupData, UserId: this.id });
    } catch (e) {
      console.error('user.createGroup: unable to create group', groupData, e);
      throw e;
    }
    const memberships = [
      {
        GroupId: group.id,
        UserId: this.id,
        role: 'ADMIN',
      },
      {
        GroupId: group.id,
        UserId: this.id,
        role: 'FOLLOWER',
      },
    ];
    try {
      await models.Member.bulkCreate(memberships);
    } catch (e) {
      console.error('user.createGroup: unable to bulk create memberships', memberships);
      throw e;
    }
    return group;
  };

  /**
   * Create a post and add this user as ADMIN and FOLLOWER
   */
  User.prototype.createPost = async function(postData) {
    let post;
    try {
      post = await models.Post.create({ ...postData, UserId: this.id });
    } catch (e) {
      console.error('user.createPost: unable to create post', postData, e);
      throw e;
    }
    const memberships = [
      {
        PostId: post.id,
        UserId: this.id,
        role: 'ADMIN',
      },
      {
        PostId: post.ParentPostId || post.id, // we only follow the thread
        UserId: this.id,
        role: 'FOLLOWER',
      },
    ];
    await memberships.map(models.Member.findOrCreate);
    return post;
  };

  /**
   * Join a group
   * @PRE: target { GroupId, PostId, role }
   * @POST: a new Member row is created
   */
  User.prototype.join = function(target) {
    return models.Member.findOrCreate({
      ...target,
      UserId: this.id,
    });
  };

  User.prototype.follow = function(target) {
    return this.join({ ...target, role: 'FOLLOWER' });
  };

  User.prototype.unfollow = function(target) {
    const where = {
      ...target,
      UserId: this.id,
      role: 'FOLLOWER',
    };
    return models.Member.destroy({
      where,
    });
  };

  User.findByEmail = emailAddr => {
    if (!emailAddr) return;
    return User.findOne({ where: { email: emailAddr.toLowerCase() } });
  };

  User.associate = m => {
    // associations can be defined here
    // User.hasMany(m.Post);
    // User.hasMany(m.Group); // a user can create many groups
    // User.belongsToMany(m.Group, {
    //   through: { model: m.Member },
    //   foreignKey: 'UserId',
    // });
  };

  return User;
};
