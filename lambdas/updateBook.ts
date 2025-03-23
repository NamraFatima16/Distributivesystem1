import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommandInput, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const ddbDocClient = createDDbDocClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
  console.log("[EVENT]", JSON.stringify(event));
  const pathParameters = event?.pathParameters
  let genre = pathParameters?.genre
  const isbn = pathParameters?.ISBN
  const body = event.body ? JSON.parse(event.body) : undefined;

  if (!body) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Missing request body" })
    }
  }

  if (!genre || !isbn) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Missing genre or ISBN in path parameters" })
    }
  }

  try {
    genre = decodeURIComponent(genre)
  } catch (error) {
    console.log("Error decoding genre:", error);
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Invalid genre format" })
    };
  }


  let updateExpressions: string[] = [];
  const expressionAttributeValues: any = {};

  const updateCommand: UpdateCommandInput = {
    TableName: process.env.TABLE_NAME,
    Key: { Genre: genre, ISBN: isbn},
    // Since updatecommand can create a new item and we only want to update..
    ConditionExpression: "attribute_exists(Genre) AND attribute_exists(ISBN)",
    ReturnValues: "ALL_NEW"
  }

  // build the update expression
  for (const key in body) {
    updateExpressions.push(`${key} = :${key.toLowerCase()}`)
    expressionAttributeValues[`:${key.toLowerCase()}`] = body[key]
  }

  if(updateExpressions.length > 0){
    updateCommand.UpdateExpression = `set ${updateExpressions.join(", ")}`;
    updateCommand.ExpressionAttributeValues = expressionAttributeValues
  }

  try {
    const updateOutput = await ddbDocClient.send( new UpdateCommand(updateCommand))
    if (updateOutput.Attributes) {
      return {
        statusCode: 200,
        body: JSON.stringify(updateOutput.Attributes),
      };
    } else {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Nothing to update" }),
      };
    }
  } catch (error: any) {
    console.log("Error updating book:", JSON.stringify(error));
    return {
      statusCode: error.name === "ConditionalCheckFailedException" ? 404 : 500,
      body: JSON.stringify({ error: "Could not update book" })
    };
  }
}

function createDDbDocClient() {
  const ddbClient = new DynamoDBClient({ region: process.env.REGION });
  const marshallOptions = {
    convertEmptyValues: true,
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  };
  const unmarshallOptions = {
    wrapNumbers: false,
  };
  const translateConfig = { marshallOptions, unmarshallOptions };
  return DynamoDBDocumentClient.from(ddbClient, translateConfig);
}
