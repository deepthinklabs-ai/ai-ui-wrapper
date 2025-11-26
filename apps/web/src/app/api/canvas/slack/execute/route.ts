/**
 * Slack Execute API Route
 *
 * Executes Slack tool calls for Genesis Bot nodes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { WebClient } from '@slack/web-api';
import { getSlackBotToken } from '@/lib/slackTokenStorage';
import type { SlackPermissions } from '@/app/canvas/features/slack-oauth/types';

interface ExecuteRequestBody {
  toolName: string;
  params: any;
  userId: string;
  nodeId: string;
  permissions: SlackPermissions;
}

export async function POST(request: NextRequest) {
  try {
    const body: ExecuteRequestBody = await request.json();
    const { toolName, params, userId, nodeId, permissions } = body;

    if (!toolName || !userId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get authenticated Slack client
    const token = await getSlackBotToken(userId);
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'No Slack OAuth connection found' },
        { status: 401 }
      );
    }

    const slack = new WebClient(token);
    let result: any;

    switch (toolName) {
      case 'slack_list_channels':
        if (!permissions.canReadChannels) throw new Error('Channel read permission not granted');
        const channelsResponse = await slack.conversations.list({
          types: params.types || 'public_channel',
          limit: params.limit || 100,
          exclude_archived: true,
        });
        return NextResponse.json({
          success: true,
          data: {
            channels: channelsResponse.channels?.map((ch) => ({
              id: ch.id,
              name: ch.name,
              is_private: ch.is_private,
              is_member: ch.is_member,
            })) || [],
          },
        });

      case 'slack_get_channel_history':
        if (!permissions.canReadChannels) throw new Error('Channel read permission not granted');
        const historyResponse = await slack.conversations.history({
          channel: params.channel,
          limit: params.limit || 20,
        });
        return NextResponse.json({
          success: true,
          data: {
            messages: historyResponse.messages || [],
            has_more: historyResponse.has_more,
          },
        });

      case 'slack_post_message':
        if (!permissions.canPostMessages) throw new Error('Post message permission not granted');
        const postResponse = await slack.chat.postMessage({
          channel: params.channel,
          text: params.text,
        });
        return NextResponse.json({
          success: true,
          data: { ts: postResponse.ts, channel: postResponse.channel },
        });

      case 'slack_reply_to_thread':
        if (!permissions.canPostMessages) throw new Error('Post message permission not granted');
        const replyResponse = await slack.chat.postMessage({
          channel: params.channel,
          thread_ts: params.thread_ts,
          text: params.text,
        });
        return NextResponse.json({
          success: true,
          data: { ts: replyResponse.ts, thread_ts: params.thread_ts },
        });

      case 'slack_add_reaction':
        if (!permissions.canReact) throw new Error('Reaction permission not granted');
        await slack.reactions.add({
          channel: params.channel,
          timestamp: params.timestamp,
          name: params.name,
        });
        return NextResponse.json({ success: true, data: { added: true } });

      case 'slack_remove_reaction':
        if (!permissions.canReact) throw new Error('Reaction permission not granted');
        await slack.reactions.remove({
          channel: params.channel,
          timestamp: params.timestamp,
          name: params.name,
        });
        return NextResponse.json({ success: true, data: { removed: true } });

      case 'slack_get_user_info':
        if (!permissions.canReadUsers) throw new Error('User read permission not granted');
        const userResponse = await slack.users.info({ user: params.user });
        return NextResponse.json({
          success: true,
          data: {
            id: userResponse.user?.id,
            name: userResponse.user?.name,
            real_name: userResponse.user?.real_name,
            email: userResponse.user?.profile?.email,
          },
        });

      case 'slack_list_users':
        if (!permissions.canReadUsers) throw new Error('User read permission not granted');
        const usersResponse = await slack.users.list({ limit: params.limit || 100 });
        return NextResponse.json({
          success: true,
          data: {
            users: usersResponse.members?.filter((u) => !u.deleted).map((u) => ({
              id: u.id,
              name: u.name,
              real_name: u.real_name,
            })) || [],
          },
        });

      case 'slack_upload_file':
        if (!permissions.canUploadFiles) throw new Error('File upload permission not granted');
        const fileResponse = await slack.files.uploadV2({
          channels: params.channels,
          content: params.content,
          filename: params.filename || 'snippet.txt',
          title: params.title,
          initial_comment: params.initial_comment,
        });
        return NextResponse.json({
          success: true,
          data: { file_id: fileResponse.file?.id },
        });

      case 'slack_create_channel':
        if (!permissions.canManageChannels) throw new Error('Channel management permission not granted');
        const createResponse = await slack.conversations.create({
          name: params.name.toLowerCase().replace(/\s+/g, '-'),
          is_private: params.is_private || false,
        });
        return NextResponse.json({
          success: true,
          data: {
            id: createResponse.channel?.id,
            name: createResponse.channel?.name,
          },
        });

      default:
        return NextResponse.json(
          { success: false, error: `Unknown tool: ${toolName}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Slack Execute API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
