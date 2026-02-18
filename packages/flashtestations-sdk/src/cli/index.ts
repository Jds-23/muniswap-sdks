#!/usr/bin/env node
/**
 * Flashtestations SDK CLI
 *
 * Verify TEE-built blocks on Unichain from the command line.
 */

import { Command } from 'commander'

import { createChainsCommand } from './commands/chains'
import { createComputeIdCommand } from './commands/computeId'
import { createGetEventCommand } from './commands/getEvent'
import { createVerifyCommand } from './commands/verify'

declare const __VERSION__: string

const program = new Command()

program
  .name('flashtestations')
  .description('Flashtestations SDK - Verify TEE-built blocks on Unichain')
  .version(__VERSION__, '-V, --version', 'Output the version number')

// Register commands
program.addCommand(createVerifyCommand())
program.addCommand(createGetEventCommand())
program.addCommand(createComputeIdCommand())
program.addCommand(createChainsCommand())

// Parse command line arguments
program.parse()
