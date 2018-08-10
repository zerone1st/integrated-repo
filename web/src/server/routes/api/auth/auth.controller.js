const jwt = require('jsonwebtoken');
const Account = require('../../../models/account');

/*
    POST /api/auth/register
    {
      email,
      password
    }
*/

exports.register = (req, res) => {
  const { username, email, password, isJunggae } = req.body;
  let newAccount = null;

  // 유저가 존재하지 않으면 새 유저 생성
  const create = account => {
    if (account) {
      throw new Error('username exists');
    } else {
      return Account.create(username, email, password, isJunggae);
    }
  };

  // 유저 수 카운트
  const count = account => {
    newAccount = account;
    return Account.countDocuments({}).exec();
  };

  // 유저 수가 1이면 admin 부여
  const assign = count => {
    if (count === 1) {
      return newAccount.assignAdmin();
    } else {
      // if not, return a promise that returns false;
      return Promise.resolve(false);
    }
  };

  // 클라이언트에게 응답
  const respond = isAdmin => {
    res.json({
      message: 'registered successfully',
      admin: isAdmin ? true : false
    });
  };

  // 에러가 있을 때 실행되는 함수 (이미 존재하는 email)
  const onError = error => {
    res.status(409).json({
      message: error.message
    });
  };

  // email 중복 체크
  Account.findByEmail(email)
    .then(create)
    .then(count)
    .then(assign)
    .then(respond)
    .catch(onError);
};

/*
    POST /api/auth/login
    {
      email,
      password
    }
*/

exports.login = (req, res) => {
  const { email, password } = req.body;
  const secret = process.env.SECRET_KEY;

  // 유저의 정보를 확인하고, token 발급
  const check = account => {
    const { profile } = account;

    if (!account) {
      // 유저가 존재하지 않음
      throw new Error('login failed');
    } else {
      // 유저가 존재하면, 비밀번호 확인
      if (account.validatePassword(password)) {
        // JWT를 비동기적으로 생성하는 Promise 객체 생성
        const p = new Promise((resolve, reject) => {
          jwt.sign(
            {
              _id: account._id,
              admin: account.admin,
              email: email
            },
            secret,
            {
              expiresIn: '7d',
              issuer: 'boomable.io',
              subject: 'userInfo'
            },
            (err, token) => {
              if (err) reject(err);
              resolve({ token, profile });
            }
          );
        });
        return p;
      } else {
        throw new Error('login failed');
      }
    }
  };

  // token 응답
  const respond = ({ token, profile }) => {
    res.cookie('access_token', token, {
      expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // 유효기간 7일
      httpOnly: true
    });
    res.json(profile);
  };

  // 에러 발생
  const onError = error => {
    res.status(403).json({
      message: error.message
    });
  };

  // 유저 찾기
  Account.findByEmail(email)
    .then(check)
    .then(respond)
    .catch(onError);
};

/*
    POST /api/auth/logout
*/

exports.logout = (req, res) => {
  res.clearCookie('access-token');
  res.status(204).end(); // 데이터 없이 응답
};