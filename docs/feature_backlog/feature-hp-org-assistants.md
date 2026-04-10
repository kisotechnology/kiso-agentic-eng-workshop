# Feature: HP Org assistants

## Summary

Create a new type of agent interface that acts as assistants to different members of the HP organization. We want to create
assistants for 2 different entities:
- Executive
- Data Scientist

Each agent will accept information from outside the organization, including questions, requests, documents, unstructured data, and manipulate them to be suitable for the entity they support. For example, the executive prefes short, 1-paragraph summaries of the information.


## Behavior 

We need a new front-end page that is similar to the existing page but
- rather than selecting reviewer agents, selects from the list of coporate entities
- allow for unstructured text upload that will be provided to the respective agent
