const db = require('../config/database');

class VideoStreaming {
    constructor(data) {
        this.id = data.id;
        this.user_id = data.user_id;
        this.session_id = data.session_id;
        this.avatar_id = data.avatar_id;
        this.voice_id = data.voice_id;
        this.created_at = data.created_at;
        this.updated_at = data.updated_at;
        this.status = data.status;
    }

    static async createSession(userData) {
        try {
            const [result] = await db.execute(
                'INSERT INTO video_streaming (user_id, session_id, avatar_id, voice_id, status) VALUES (?, ?, ?, ?, ?)',
                [userData.user_id, userData.session_id, userData.avatar_id, userData.voice_id, 'active']
            );
            return result.insertId;
        } catch (error) {
            console.error('Error creating video streaming session:', error);
            throw error;
        }
    }

    static async getSessionById(sessionId) {
        try {
            const [rows] = await db.execute(
                'SELECT * FROM video_streaming WHERE session_id = ?',
                [sessionId]
            );
            return rows[0] ? new VideoStreaming(rows[0]) : null;
        } catch (error) {
            console.error('Error getting video streaming session:', error);
            throw error;
        }
    }

    static async getUserSessions(userId) {
        try {
            const [rows] = await db.execute(
                'SELECT * FROM video_streaming WHERE user_id = ? ORDER BY created_at DESC',
                [userId]
            );
            return rows.map(row => new VideoStreaming(row));
        } catch (error) {
            console.error('Error getting user video streaming sessions:', error);
            throw error;
        }
    }

    async updateStatus(status) {
        try {
            await db.execute(
                'UPDATE video_streaming SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [status, this.id]
            );
            this.status = status;
            return true;
        } catch (error) {
            console.error('Error updating video streaming status:', error);
            throw error;
        }
    }

    async saveStreamingText(text, type) {
        try {
            await db.execute(
                'INSERT INTO video_streaming_text (streaming_id, text_content, text_type) VALUES (?, ?, ?)',
                [this.id, text, type]
            );
            return true;
        } catch (error) {
            console.error('Error saving streaming text:', error);
            throw error;
        }
    }

    static async getStreamingTexts(streamingId) {
        try {
            const [rows] = await db.execute(
                'SELECT * FROM video_streaming_text WHERE streaming_id = ? ORDER BY created_at ASC',
                [streamingId]
            );
            return rows;
        } catch (error) {
            console.error('Error getting streaming texts:', error);
            throw error;
        }
    }
}

module.exports = VideoStreaming;