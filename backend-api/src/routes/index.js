const express = require('express');
const postsRouter = require('./posts');
const commentsRouter = require('./comments');
const authRouter = require('./auth');
const internalRouter = require('./internal');

const router = express.Router();

router.use('/auth', authRouter);
router.use('/posts', postsRouter);
router.use('/comments', commentsRouter);
router.use('/internal', internalRouter);

module.exports = router;
