const jwt = require('jsonwebtoken');
const Account = require('../../../models/account');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const EmailAuth = require('../../../models/emailAuth');
const nodemailer = require('nodemailer');
const randomstring = require('randomstring');

const DIR_PATH = path.resolve(__dirname, '../../../uploads');

/*
    POST /api/auth/profile
    form-data {
      profile
    }
*/

/**
 * 프로필 사진 업로드
 * @param {*} req
 * @param {*} res
 */
exports.profile = (req, res) => {
  const upload = multer({
    storage: multer.diskStorage({
      // 저장될 경로와 파일명 지정
      destination: function(req, file, cb) {
        cb(null, DIR_PATH);
      },
      filename: function(req, file, cb) {
        cb(null, new Date().valueOf() + '_' + file.originalname); // 타임스탬프 + 원래 파일명
      }
    }),
    fileFilter: function(req, file, cb) {
      if (checkImage(file)) {
        cb(null, true); // 파일 허용
      } else {
        cb(null, false); // 파일 거부
      }
    }
  }).single('profile'); // req.file은 profile 필드의 파일 정보

  // 이미지인지 확장자와 MIME 타입 체크
  const checkImage = profile => {
    const mimeType = profile.mimetype.split('/');
    const fileType = mimeType[1];

    return fileType === 'jpg' || fileType === 'jpeg' || fileType === 'png';
  };

  const profileUpload = new Promise((resolve, reject) => {
    if (fs.existsSync(DIR_PATH) === false) {
      fs.mkdirSync(DIR_PATH);
    }
    upload(req, res, err => {
      if (err) reject(err);
      if (!!req.file === false) reject(new Error('file type error'));
      resolve(req.file.filename);
    });
  });

  profileUpload
    .then(path => {
      res.json({ path });
    })
    .catch(err => {
      res.status(403).json({
        message: err
      });
    });
};

/*
    POST /api/auth/register
    {
      ethAddress,
      profileFilename,
      username,
      email
    }
*/

exports.register = async (req, res) => {
  const { ethAddress, profileFilename, username, email } = req.body;
  const createAccount = async () => {
    const emailAuth = await EmailAuth.findOne({ email });
    let account = null;
    if (emailAuth.status === 1) {
      account = await Account.create(
        ethAddress,
        profileFilename,
        username,
        email
      );
      await EmailAuth.updateStatus(email, 2);
    }
    return account;
  };

  const assignAdmin = async account => {
    if ((await Account.countDocuments({}).exec()) === 1) {
      await account.assignAdmin();
      return true;
    }
    return false;
  };

  try {
    const accounts = await Account.findByEthAddress(ethAddress);
    if (!!accounts === false) {
      const newAccount = await createAccount();
      if (!!newAccount) {
        const isAdmin = await assignAdmin(newAccount);
        res.json({
          message: 'registered successfully',
          admin: isAdmin
        });
      } else {
        res.status(409).json({
          message: 'invalid email'
        });
      }
    } else {
      res.status(409).json({
        message: 'already sign up'
      });
    }
  } catch (err) {
    res.status(409).json({
      message: err
    });
  }
};

/*
    POST /api/auth/login
    {
      email,
      password
    }
*/

exports.login = (req, res) => {
  const { ethAddress } = req.body;
  const secret = process.env.SECRET_KEY;

  // 유저의 정보를 확인하고, token 발급
  const check = account => {
    const { profile, isJunggae } = account;
    const loggedInfo = {
      profile,
      isJunggae
    };

    if (!account) {
      // 유저가 존재하지 않음
      throw new Error('login failed');
    } else {
      // 유저가 존재하면, JWT를 비동기적으로 생성하는 Promise 객체 생성
      const p = new Promise((resolve, reject) => {
        jwt.sign(
          {
            _id: account._id,
            admin: account.admin,
            ethAddress
          },
          secret,
          {
            expiresIn: '7d',
            issuer: 'blockon.house',
            subject: 'userInfo'
          },
          (err, token) => {
            if (err) reject(err);
            resolve({ token, loggedInfo });
          }
        );
      });
      return p;
    }
  };

  // token 응답
  const respond = ({ token, loggedInfo }) => {
    res.cookie('access_token', token, {
      expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // 유효기간 7일
      httpOnly: true
    });
    res.json(loggedInfo);
  };

  // 에러 발생
  const onError = error => {
    res.status(403).json({
      message: error.message
    });
  };

  // 유저 찾기
  Account.findByEthAddress(ethAddress)
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

/**
 * 인증 email 전송
 * @param req
 * @param res
 */
exports.sendAuthEmail = async (req, res) => {
  const { email } = req.body;

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.email_id, // gmail 계정 아이디를 입력
      pass: process.env.email_password // gmail 계정의 비밀번호를 입력
    }
  });

  const token = randomstring.generate(8);
  const uri = `${
    process.env.blockon_uri
  }/api/auth/authEmail/?email=${email}&token=${token}`;
  const mailOptions = {
    from: process.env.email_id,
    to: email,

    subject: '안녕하세요, BlockOn 입니다. 이메일 인증을 해주세요.',
    html: `<p>BlockOn Email 인증</p><a href="${uri}">인증하기</a>`
  };

  const createEmailAuth = async () => {
    const emailAuth = await EmailAuth.findOne({ email });
    if (!!emailAuth) {
      switch (emailAuth.status) {
      case 0:
      case 1:
        await EmailAuth.updateToken(email, token);
        return true;
      case 2:
        //이미 가입된 이메일
        return false;
      default:
      }
    } else {
      await EmailAuth.create(email, token);
      return true;
    }
  };

  try {
    await transporter.sendMail(mailOptions);
    const result = await createEmailAuth();
    res.json({
      result
    });
  } catch (e) {
    res.json({
      result: false,
      info: e
    });
  }
};

/**
 * 이메일 인증 - 인증 이메일에서 인증하기 버튼 클릭시 호출
 * @param req
 * @param res
 */
exports.authEmail = async (req, res) => {
  const { email, token } = req.query;
  const updateEmailStatus = async () => {
    const emailAuth = await EmailAuth.findOne({ email });
    switch (emailAuth.status) {
    case 0:
      if (emailAuth.token === token) {
        await EmailAuth.updateStatus(email, 1);
        return 'certification';
      } else {
        return 'invalid token';
      }
    case 1:
      return 'already certification';
    case 2:
      return 'already signed up';
    default:
    }
  };

  try {
    let result = await updateEmailStatus();
    res.send(`<script>alert('${result}');close();</script>`);
  } catch (err) {
    res.send(`<script>alert('${err}'); close();</script>`);
  }
};
