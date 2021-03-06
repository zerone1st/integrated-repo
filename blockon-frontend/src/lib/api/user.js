import defaultClient from 'lib/defaultClient';

export const updateAccountAddressByEthAddress = (
  accountAddress,
  ethAddress
) => {
  return defaultClient.put(`/api/user/${ethAddress}`, {
    accountAddress
  });
};

export const getEmailList = value => {
  return defaultClient.post('/api/user/email', {
    value
  });
};

export const getAccountByEthAddress = ethAddress => {
  return defaultClient.post('/api/user', {
    ethAddress
  });
};

export const getAccountByEamil = email => {
  return defaultClient.post('/api/user', {
    email
  });
};
