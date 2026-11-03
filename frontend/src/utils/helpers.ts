export function generateRandomAddress(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const length = 12;
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function generatePassword(length?: number): string {
  const finalLength = length || Math.floor(Math.random() * 11) + 25;
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let result = '';
  for (let i = 0; i < finalLength; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// 生成完整帐号信息（带分隔线和用户名/密码的固定格式）
export function buildAccountInfoText(opts: {
  siteUrl: string;
  fullAddress: string;
  password: string;
  title: string;
  usernameLabel: string;
  passwordLabel: string;
}): string {
  const sep = '-----------------------------------------------';
  return [
    sep,
    `${opts.title}：`,
    opts.siteUrl,
    '',
    `${opts.usernameLabel}：`,
    opts.fullAddress,
    `${opts.passwordLabel}：`,
    opts.password,
    sep,
    '',
  ].join('\n');
}
