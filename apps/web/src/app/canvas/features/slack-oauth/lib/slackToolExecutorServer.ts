/**
 * Slack Tool Executor (Server-side)
 *
 * Executes Slack tool calls using the @slack/web-api SDK.
 * This is used by the Ask/Answer API route for server-side execution.
 */

import { WebClient } from '@slack/web-api';
import { getSlackBotToken } from '@/lib/slackTokenStorage';
import type { SlackPermissions } from '../types';

interface ToolCall {
  id: string;
  name: string;
  input: any;
}

interface ToolResult {
  toolCallId: string;
  result: string;
  isError: boolean;
}

/**
 * Get a Slack WebClient for a user
 */
async function getSlackClient(userId: string): Promise<WebClient> {
  const token = await getSlackBotToken(userId);
  if (!token) {
    throw new Error('No Slack connection found');
  }
  return new WebClient(token);
}

/**
 * Execute Slack tool calls server-side
 */
export async function executeSlackToolCallsServer(
  toolCalls: ToolCall[],
  userId: string,
  nodeId: string,
  permissions: SlackPermissions
): Promise<ToolResult[]> {
  const results: ToolResult[] = [];

  let slack: WebClient;
  try {
    slack = await getSlackClient(userId);
  } catch (error) {
    console.error('[SlackExecutor] Failed to get Slack client:', error);
    return toolCalls.map((call) => ({
      toolCallId: call.id,
      result: JSON.stringify({ error: 'Failed to initialize Slack client' }),
      isError: true,
    }));
  }

  for (const call of toolCalls) {
    try {
      console.log(`[SlackExecutor] Executing ${call.name} for node ${nodeId}`);

      let result: any;

      switch (call.name) {
        case 'slack_list_channels':
          if (!permissions.canReadChannels) throw new Error('Channel read permission not granted');
          result = await executeListChannels(slack, call.input);
          break;

        case 'slack_get_channel_history':
          if (!permissions.canReadChannels) throw new Error('Channel read permission not granted');
          result = await executeGetChannelHistory(slack, call.input);
          break;

        case 'slack_post_message':
          if (!permissions.canPostMessages) throw new Error('Post message permission not granted');
          result = await executePostMessage(slack, call.input);
          break;

        case 'slack_reply_to_thread':
          if (!permissions.canPostMessages) throw new Error('Post message permission not granted');
          result = await executeReplyToThread(slack, call.input);
          break;

        case 'slack_add_reaction':
          if (!permissions.canReact) throw new Error('Reaction permission not granted');
          result = await executeAddReaction(slack, call.input);
          break;

        case 'slack_remove_reaction':
          if (!permissions.canReact) throw new Error('Reaction permission not granted');
          result = await executeRemoveReaction(slack, call.input);
          break;

        case 'slack_get_user_info':
          if (!permissions.canReadUsers) throw new Error('User read permission not granted');
          result = await executeGetUserInfo(slack, call.input);
          break;

        case 'slack_list_users':
          if (!permissions.canReadUsers) throw new Error('User read permission not granted');
          result = await executeListUsers(slack, call.input);
          break;

        case 'slack_upload_file':
          if (!permissions.canUploadFiles) throw new Error('File upload permission not granted');
          result = await executeUploadFile(slack, call.input);
          break;

        case 'slack_create_channel':
          if (!permissions.canManageChannels) throw new Error('Channel management permission not granted');
          result = await executeCreateChannel(slack, call.input);
          break;

        default:
          throw new Error(`Unknown tool: ${call.name}`);
      }

      results.push({
        toolCallId: call.id,
        result: JSON.stringify(result),
        isError: false,
      });
    } catch (error) {
      console.error(`[SlackExecutor] Error executing ${call.name}:`, error);
      results.push({
        toolCallId: call.id,
        result: JSON.stringify({
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
        isError: true,
      });
    }
  }

  return results;
}

// Tool implementations

async function executeListChannels(slack: WebClient, params: { types?: string; limit?: number }) {
  const response = await slack.conversations.list({
    types: params.types || 'public_channel',
    limit: params.limit || 100,
    exclude_archived: true,
  });

  return {
    channels: response.channels?.map((ch) => ({
      id: ch.id,
      name: ch.name,
      is_private: ch.is_private,
      is_member: ch.is_member,
      num_members: ch.num_members,
      topic: ch.topic?.value,
      purpose: ch.purpose?.value,
    })) || [],
    count: response.channels?.length || 0,
  };
}

async function executeGetChannelHistory(slack: WebClient, params: { channel: string; limit?: number }) {
  const response = await slack.conversations.history({
    channel: params.channel,
    limit: params.limit || 20,
  });

  return {
    messages: response.messages?.map((msg) => ({
      type: msg.type,
      user: msg.user,
      text: msg.text,
      ts: msg.ts,
      thread_ts: msg.thread_ts,
      reply_count: msg.reply_count,
      reactions: msg.reactions,
    })) || [],
    has_more: response.has_more,
  };
}

async function executePostMessage(slack: WebClient, params: { channel: string; text: string }) {
  const response = await slack.chat.postMessage({
    channel: params.channel,
    text: params.text,
  });

  return {
    success: response.ok,
    channel: response.channel,
    ts: response.ts,
    message: response.message,
  };
}

async function executeReplyToThread(slack: WebClient, params: { channel: string; thread_ts: string; text: string }) {
  const response = await slack.chat.postMessage({
    channel: params.channel,
    thread_ts: params.thread_ts,
    text: params.text,
  });

  return {
    success: response.ok,
    channel: response.channel,
    ts: response.ts,
    thread_ts: params.thread_ts,
  };
}

async function executeAddReaction(slack: WebClient, params: { channel: string; timestamp: string; name: string }) {
  const response = await slack.reactions.add({
    channel: params.channel,
    timestamp: params.timestamp,
    name: params.name,
  });

  return {
    success: response.ok,
  };
}

async function executeRemoveReaction(slack: WebClient, params: { channel: string; timestamp: string; name: string }) {
  const response = await slack.reactions.remove({
    channel: params.channel,
    timestamp: params.timestamp,
    name: params.name,
  });

  return {
    success: response.ok,
  };
}

async function executeGetUserInfo(slack: WebClient, params: { user: string }) {
  const response = await slack.users.info({
    user: params.user,
  });

  const user = response.user;
  return {
    id: user?.id,
    name: user?.name,
    real_name: user?.real_name,
    display_name: user?.profile?.display_name,
    email: user?.profile?.email,
    image: user?.profile?.image_72,
    is_bot: user?.is_bot,
    is_admin: user?.is_admin,
    timezone: user?.tz,
  };
}

async function executeListUsers(slack: WebClient, params: { limit?: number }) {
  const response = await slack.users.list({
    limit: params.limit || 100,
  });

  return {
    users: response.members?.filter((u) => !u.deleted).map((u) => ({
      id: u.id,
      name: u.name,
      real_name: u.real_name,
      display_name: u.profile?.display_name,
      is_bot: u.is_bot,
    })) || [],
    count: response.members?.filter((u) => !u.deleted).length || 0,
  };
}

async function executeUploadFile(
  slack: WebClient,
  params: { channels: string; content: string; filename?: string; title?: string; initial_comment?: string }
) {
  const response = await slack.files.uploadV2({
    channels: params.channels,
    content: params.content,
    filename: params.filename || 'snippet.txt',
    title: params.title,
    initial_comment: params.initial_comment,
  });

  return {
    success: response.ok,
    file: response.file ? {
      id: response.file.id,
      name: response.file.name,
      url: response.file.url_private,
    } : null,
  };
}

async function executeCreateChannel(slack: WebClient, params: { name: string; is_private?: boolean }) {
  const response = await slack.conversations.create({
    name: params.name.toLowerCase().replace(/\s+/g, '-'),
    is_private: params.is_private || false,
  });

  return {
    success: response.ok,
    channel: response.channel ? {
      id: response.channel.id,
      name: response.channel.name,
      is_private: response.channel.is_private,
    } : null,
  };
}
