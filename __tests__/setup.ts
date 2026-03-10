/**
 * DevFlow v5 - Jest 测试环境设置
 *
 * 在每个测试文件执行前运行，配置全局测试环境
 */

// 设置测试环境变量
process.env.NODE_ENV = 'test';

// 全局错误处理
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
